import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'

const RELOADED = 'fleet.newBuildReload'
const AGAIN_AFTER = 10_000

export function reloadForNewBuild(): boolean {
    const last = Number(sessionStorage.getItem(RELOADED) ?? 0)
    if (Date.now() - last < AGAIN_AFTER) return false
    sessionStorage.setItem(RELOADED, String(Date.now()))
    window.location.reload()
    return true
}

export function reloadOnMissingChunks() {
    window.addEventListener('vite:preloadError', (event) => {
        if (reloadForNewBuild()) event.preventDefault()
    })
}

export function withLoadErrors(routes: RouteObject[]): RouteObject[] {
    return routes.map((route) => {
        const lazy = route.lazy
        const load = typeof lazy === 'object' ? lazy.Component : undefined
        const children = route.children && withLoadErrors(route.children)
        if (typeof lazy !== 'object' || !load) return { ...route, children } as RouteObject
        const Component = async (): Promise<ComponentType> => {
            try {
                return (await load()) as ComponentType
            } catch (error) {
                return function Unloaded(): never {
                    throw error
                }
            }
        }
        return { ...route, children, lazy: { ...lazy, Component } } as RouteObject
    })
}
