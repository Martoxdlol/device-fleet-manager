import { createContext, useContext, type ComponentType, type ReactNode } from 'react'

export type BoundaryName = 'main' | 'left' | 'right' | 'rail' | 'dialog'

export type Boundary = ComponentType<{ name: BoundaryName; children: ReactNode }>

const Passthrough: Boundary = ({ children }) => children

export const BoundaryContext = createContext<Boundary>(Passthrough)

export function useBoundary() {
    return useContext(BoundaryContext)
}
