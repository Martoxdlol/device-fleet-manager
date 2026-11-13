import { createContext, useContext } from 'react'
import { getInsets } from './geometry'
export const ScaffoldContext = createContext<ReturnType<typeof getInsets> | null>(null)
export function useScaffold() {
    const value = useContext(ScaffoldContext)
    if (!value) throw new Error('useScaffold requires Scaffold')
    return value
}
