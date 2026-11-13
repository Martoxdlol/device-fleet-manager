import { createContext, useContext } from 'react'

export interface ViewStorage {
    read<T>(key: string, parse: (raw: unknown) => T | undefined): T | undefined
    write(key: string, value: unknown): void
}

export const StorageContext = createContext<ViewStorage | null>(null)

export function useStorage() {
    const value = useContext(StorageContext)
    if (!value) throw new Error('useStorage requires StorageProvider')
    return value
}
