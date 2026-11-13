import { createContext, useContext } from 'react'
import type { DragChannel } from './drag-model'

export interface DragSession {
    begin: (type: string, payload: unknown) => void
    end: () => void
    /** The running drag's payload when it travels this channel, else null. */
    read: <T>(channel: DragChannel<T>) => T | null
    /** A target taking the drag says what a drop would do, in the reader's language, for the
     * label at the pointer: "Move to Photos". */
    hint: (text: string) => void
}

export const DragContext = createContext<DragSession | null>(null)

export function useDragSession() {
    const session = useContext(DragContext)
    if (!session) throw new Error('DragProvider is required')
    return session
}
