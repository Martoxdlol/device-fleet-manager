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
/** The window's width, for the device itself: what fits on the screen, whatever the app shows. */
export function useScreenWidth() {
    return useSyncExternalStore(
        subscribeResize,
        () => window.innerWidth,
        () => 0,
    )
}
/** The window's height, for the device itself. */
export function useScreenHeight() {
    return useSyncExternalStore(
        subscribeResize,
        () => window.innerHeight,
        () => 0,
    )
}
// Layout boundaries live here alone, so no stylesheet has to restate them. Inside an AppFrame they
// answer to the app area, as the `app-*` variants do, so a docked column narrows the app like a
// smaller screen. Outside one, the screen is the app.
export const MOBILE_WIDTH = 768
export const STACKED_WIDTH = 1100
export function useMobile() {
    const layout = useContext(AppLayoutContext)
    const screen = useMediaQuery(`(max-width: ${MOBILE_WIDTH - 1}px)`)
    return layout ? layout.mobile : screen
}
/** Below this, side panels stack over the content instead of sitting beside it. */
export function useStackedPanels() {
    const layout = useContext(AppLayoutContext)
    const screen = useMediaQuery(`(max-width: ${STACKED_WIDTH - 1}px)`)
    return layout ? layout.stacked : screen
}
