import { useCallback, useContext, useSyncExternalStore } from 'react'
import { AppLayoutContext } from './app-frame-context'
export function useMediaQuery(query: string) {
    const subscribe = useCallback(
        (callback: () => void) => {
            const media = window.matchMedia(query)
            media.addEventListener('change', callback)
            return () => media.removeEventListener('change', callback)
        },
        [query],
    )
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => false,
    )
}
function subscribeResize(callback: () => void) {
    window.addEventListener('resize', callback)
    return () => window.removeEventListener('resize', callback)
}
export function useScreenWidth() {
    return useSyncExternalStore(
        subscribeResize,
        () => window.innerWidth,
        () => 0,
    )
}
export function useScreenHeight() {
    return useSyncExternalStore(
        subscribeResize,
        () => window.innerHeight,
        () => 0,
    )
}
export const MOBILE_WIDTH = 768
export const STACKED_WIDTH = 1100
export function useMobile() {
    const layout = useContext(AppLayoutContext)
    const screen = useMediaQuery(`(max-width: ${MOBILE_WIDTH - 1}px)`)
    return layout ? layout.mobile : screen
}
export function useStackedPanels() {
    const layout = useContext(AppLayoutContext)
    const screen = useMediaQuery(`(max-width: ${STACKED_WIDTH - 1}px)`)
    return layout ? layout.stacked : screen
}
