import { createContext, type ReactNode } from 'react'

/**
 * How the trailing tools fold into the actions' overflow menu once the leading group and its
 * actions no longer fit beside them. Only tools that can show as menu items fold: each marks its
 * button `data-dt-tool`, and a bar holding anything else never folds.
 */
export interface ToolbarFold {
    tools: ReactNode
    folded: boolean
    isFolded: () => boolean
    setFolded: (folded: boolean) => void
    /** The room the tools take beside the leading group, or 0 when they cannot fold. */
    space: () => number
}

export const ToolbarFoldContext = createContext<ToolbarFold | null>(null)
/** Inside the overflow menu, where the tools render as menu items. */
export const ToolMenuContext = createContext(false)
