import { createContext, useContext } from 'react'
export const PanelsContext = createContext<{
    openLeft: () => void
    openRight: () => void
    closePanels: () => void
} | null>(null)
export function usePanels() {
    const ctx = useContext(PanelsContext)
    if (!ctx) throw new Error('usePanels requires AppShell')
    return ctx
}
