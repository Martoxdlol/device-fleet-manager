import { createContext, useContext } from 'react'

export type NoticeAction = { label: string; run: () => void }

export const PresentationContext = createContext<{
    /** A notice fades after a moment, one with an action after longer; an error stays until
     * dismissed or replaced. */
    notify: (message: string, tone?: 'error', action?: NoticeAction) => void
} | null>(null)
export function usePresentation() {
    const value = useContext(PresentationContext)
    if (!value) throw new Error('PresentationProvider is required')
    return value
}
