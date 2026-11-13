import { createContext, useContext } from 'react'

export interface AppFrameValue {
    area: HTMLElement | null
    column: HTMLElement | null
}

export const AppFrameContext = createContext<AppFrameValue | null>(null)

export function useAppFrame() {
    const value = useContext(AppFrameContext)
    if (!value) throw new Error('useAppFrame requires AppFrame')
    return value
}

export interface AppLayout {
    mobile: boolean
    stacked: boolean
}

export const AppLayoutContext = createContext<AppLayout | null>(null)
