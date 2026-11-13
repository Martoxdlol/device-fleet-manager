import { createContext, useContext } from 'react'

/** Values remembered in this browser under the app's own prefix. */
export interface ViewStorage {
    /** What `key` holds, as `parse` accepts it. */
    read<T>(key: string, parse: (raw: unknown) => T | undefined): T | undefined
    /** Remembers `value` under `key`, when storage allows. */
    write(key: string, value: unknown): void
}

export const StorageContext = createContext<ViewStorage | null>(null)

export function useStorage() {
    const value = useContext(StorageContext)
    if (!value) throw new Error('useStorage requires StorageProvider')
    return value
}
