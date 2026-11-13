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

export function useCover(active: boolean) {
    const { setCover } = useContext(CoverContext)
    const id = useId()
    useEffect(() => {
        setCover(id, active)
        return () => setCover(id, false)
    }, [setCover, id, active])
}
