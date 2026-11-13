import { useMemo, type ReactNode } from 'react'
import { StorageContext, type ViewStorage } from './storage-context'

/** Keeps values in `localStorage` under `prefix`. Storage that is missing, full or blocked keeps nothing. */
export function StorageProvider({ prefix, children }: { prefix: string; children: ReactNode }) {
    const storage = useMemo<ViewStorage>(
        () => ({
            read(key, parse) {
                try {
                    const raw = localStorage.getItem(prefix + key)
                    if (raw === null) return undefined
                    return parse(JSON.parse(raw))
                } catch {
                    return undefined
                }
            },
            write(key, value) {
                try {
                    localStorage.setItem(prefix + key, JSON.stringify(value))
                } catch {
                    /* memory-only preference */
                }
            },
        }),
        [prefix],
    )
    return <StorageContext value={storage}>{children}</StorageContext>
}
