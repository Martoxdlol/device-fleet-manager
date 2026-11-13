import { createContext, type ReactNode } from 'react'

export interface ToolbarFold {
    tools: ReactNode
    folded: boolean
    isFolded: () => boolean
    setFolded: (folded: boolean) => void
    space: () => number
}

export const ToolbarFoldContext = createContext<ToolbarFold | null>(null)
export const ToolMenuContext = createContext(false)
