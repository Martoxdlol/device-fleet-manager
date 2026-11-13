import { createContext, useContext, type ComponentType, type ReactNode } from 'react'

/** The parts of the screen core contains a crash to, each named for the app's report. */
export type BoundaryName = 'main' | 'left' | 'right' | 'rail' | 'dialog'

export type Boundary = ComponentType<{ name: BoundaryName; children: ReactNode }>

const Passthrough: Boundary = ({ children }) => children

/** The app's error boundary, which core puts around each of its slots. None without one. */
export const BoundaryContext = createContext<Boundary>(Passthrough)

export function useBoundary() {
    return useContext(BoundaryContext)
}
