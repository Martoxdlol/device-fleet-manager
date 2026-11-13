import { createContext, useContext } from 'react'

export type History = {
    /** The path of the entry `offset` steps from the current one, when this tab has it. */
    peek(offset: number): string | undefined
    go(delta: number): void
}

export const HistoryContext = createContext<History | null>(null)

export function useHistory() {
    const value = useContext(HistoryContext)
    if (!value) throw new Error('useHistory requires HistoryProvider')
    return value
}
