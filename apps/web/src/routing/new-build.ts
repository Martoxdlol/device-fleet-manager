import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'

/**
 * A tab still running the build before a deploy asks for chunks the new one no longer has, and
 * the host answers the app's page for them (#59). Reloading takes the new build's page, which
 * names its own chunks: once, so a chunk that is still missing after it cannot reload forever.
 */
const RELOADED = 'fleet.newBuildReload'
const AGAIN_AFTER = 10_000

/** Reloads the page for a newer build, unless it just did: whether it reloads. */
export function reloadForNewBuild(): boolean {
    const last = Number(sessionStorage.getItem(RELOADED) ?? 0)
    if (Date.now() - last < AGAIN_AFTER) return false
    sessionStorage.setItem(RELOADED, String(Date.now()))
    window.location.reload()
    return true
}

/** Vite reports a lazy import whose chunks did not load: the page reloads for the new build. */
export function reloadOnMissingChunks() {
    window.addEventListener('vite:preloadError', (event) => {
        if (reloadForNewBuild()) event.preventDefault()
    })
}

/**
 * `routes` with each lazy component that cannot load standing for its error, which the nearest
 * error boundary shows with Reload. The router leaves a route whose lazy component failed empty,
 * a blank page.
 */
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
