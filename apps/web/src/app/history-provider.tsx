import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { createBrowserRouter, Location, NavigationType } from 'react-router'
import { HistoryContext, type History } from './history-context'

type Router = ReturnType<typeof createBrowserRouter>
type Entry = { key: string; path: string }
type Stack = { entries: Entry[]; index: number }

const storageKey = 'history.stack'
const limit = 100

function load(): Stack {
    try {
        const stack = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Stack | null
        if (stack && Array.isArray(stack.entries) && Number.isInteger(stack.index)) return stack
    } catch {}
    return { entries: [], index: -1 }
}

function advance(stack: Stack, type: NavigationType, location: Location): Stack {
    const entry = { key: location.key, path: location.pathname }
    if (stack.entries[stack.index]?.key === entry.key) return stack
    if (type === 'PUSH') {
        const entries = [...stack.entries.slice(0, stack.index + 1), entry].slice(-limit)
        return { entries, index: entries.length - 1 }
    }
    if (type === 'REPLACE' && stack.entries[stack.index]) {
        return { entries: stack.entries.with(stack.index, entry), index: stack.index }
    }
    const index = stack.entries.findIndex((known) => known.key === entry.key)
    return index < 0 ? { entries: [entry], index: 0 } : { entries: stack.entries, index }
}

export function HistoryProvider({ router, children }: { router: Router; children: ReactNode }) {
    const [stack, setStack] = useState(() =>
        advance(load(), router.state.historyAction, router.state.location),
    )
    useEffect(
        () =>
            router.subscribe((state) =>
                setStack((current) => advance(current, state.historyAction, state.location)),
            ),
        [router],
    )
    useEffect(() => {
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(stack))
        } catch {}
    }, [stack])
    const value = useMemo<History>(
        () => ({
            peek: (offset) => stack.entries[stack.index + offset]?.path,
            go: (delta) => void router.navigate(delta),
        }),
        [stack, router],
    )
    return <HistoryContext value={value}>{children}</HistoryContext>
}
