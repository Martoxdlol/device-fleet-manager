import { createContext, useContext } from 'react'

export const ViewportContext = createContext<{ keyboard: boolean } | null>(null)

export function useViewport() {
    const value = useContext(ViewportContext)
    if (!value) throw new Error('useViewport requires ViewportProvider')
    return value
}
