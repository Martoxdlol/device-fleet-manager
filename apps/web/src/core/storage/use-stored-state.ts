import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { useStorage } from './storage-context'

const subscribeNothing = () => () => {}

export function useStoredState<T>(
    key: string | undefined,
    fallback: T,
    parse: (raw: unknown) => T | undefined,
) {
    const storage = useStorage()
    const hydrating = useSyncExternalStore(
        subscribeNothing,
        () => false,
        () => true,
    )
    const [value, setValue] = useState<T>(() =>
        key === undefined || hydrating ? fallback : (storage.read(key, parse) ?? fallback),
    )
    const [read, setRead] = useState(!hydrating)
    useLayoutEffect(() => {
        if (read) return
        setRead(true)
        const stored = key === undefined ? undefined : storage.read(key, parse)
        if (stored !== undefined) setValue(stored)
    }, [read, key, storage, parse])
    const set = useCallback(
        (next: T | ((previous: T) => T)) => {
            setValue((previous) => {
                const resolved =
                    typeof next === 'function' ? (next as (previous: T) => T)(previous) : next
                if (key !== undefined) storage.write(key, resolved)
                return resolved
            })
        },
        [key, storage],
    )
    return [value, set] as const
}

export function oneOf<const T extends readonly string[]>(options: T) {
    return (raw: unknown): T[number] | undefined =>
        typeof raw === 'string' && options.includes(raw) ? raw : undefined
}
