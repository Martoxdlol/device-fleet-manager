import { createContext, useContext } from 'react'

export interface AppFrameValue {
    /** The app area: where the page's own overlays belong, so they never cover the column. */
    area: HTMLElement | null
    /**
     * The column beside the app area. A panel rendered into it in flow takes its own width from
     * the area; a fixed one lies over the app and takes nothing.
     */
    column: HTMLElement | null
}

export const AppFrameContext = createContext<AppFrameValue | null>(null)

export function useAppFrame() {
    const value = useContext(AppFrameContext)
    if (!value) throw new Error('useAppFrame requires AppFrame')
    return value
}

/** Which layout the app area's width calls for. Outside an `AppFrame` none. */
export interface AppLayout {
    mobile: boolean
    stacked: boolean
}

export const AppLayoutContext = createContext<AppLayout | null>(null)
