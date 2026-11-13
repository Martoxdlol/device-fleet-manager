import { createContext, useContext } from 'react'
import type { DragChannel } from './drag-model'

export interface DragSession {
    begin: (type: string, payload: unknown) => void
    end: () => void
    read: <T>(channel: DragChannel<T>) => T | null
    hint: (text: string) => void
}

export const DragContext = createContext<DragSession | null>(null)

export function useDragSession() {
    const session = useContext(DragContext)
    if (!session) throw new Error('DragProvider is required')
    return session
}
