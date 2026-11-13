import { createContext, useContext, useEffect, useId } from 'react'

export interface CoverRegistry {
    covered: boolean
    setCover: (id: string, active: boolean) => void
}
export const CoverContext = createContext<CoverRegistry>({
    covered: false,
    setCover: () => {},
})
export const useCovered = () => useContext(CoverContext).covered

/**
 * Registers a page stacked over the content area. The scaffold body is a fixed
 * element, so it stacks as one layer no matter what its children raise
 * themselves to; a covering page has to remove the floating chrome, not outrank it.
 */
export function useCover(active: boolean) {
    const { setCover } = useContext(CoverContext)
    const id = useId()
    useEffect(() => {
        setCover(id, active)
        return () => setCover(id, false)
    }, [setCover, id, active])
}
