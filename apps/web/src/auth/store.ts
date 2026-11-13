import type { Client, User } from '@fleet/client'
import { apiClient } from './config'

export const STORE_KEY = 'fleet.auth.v1'

export interface Account {
    token: string
    user: User
    lastOrgSlug: string | null
}
export interface Store {
    slots: (Account | null)[]
}

const empty: Store = { slots: [] }

function isAccount(value: unknown): value is Account {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    const user = record.user as Record<string, unknown> | undefined
    return (
        typeof record.token === 'string' &&
        !!user &&
        typeof user.id === 'string' &&
        typeof user.email === 'string'
    )
}

function trim(slots: (Account | null)[]) {
    const copy = slots.slice()
    while (copy.length && copy[copy.length - 1] === null) copy.pop()
    return copy
}

export function readStore(): Store {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as {
            slots?: unknown
        } | null
        if (!parsed || !Array.isArray(parsed.slots)) return empty
        return {
            slots: trim(parsed.slots.map((slot) => (isAccount(slot) ? slot : null))),
        }
    } catch {
        return empty
    }
}

export class AuthStore {
    private cache = readStore()
    private listeners = new Set<() => void>()
    private baseUrl: string

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl
    }

    get = () => this.cache

    subscribe = (listener: () => void) => {
        this.listeners.add(listener)
        const onStorage = (event: StorageEvent) => {
            if (event.key !== null && event.key !== STORE_KEY) return
            this.cache = readStore()
            listener()
        }
        window.addEventListener('storage', onStorage)
        return () => {
            this.listeners.delete(listener)
            window.removeEventListener('storage', onStorage)
        }
    }

    set(next: Store) {
        this.cache = { slots: trim(next.slots) }
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(this.cache))
        } catch {}
        for (const listener of this.listeners) listener()
    }

    setLastOrg(index: number, slug: string | null) {
        const account = this.cache.slots[index]
        if (account && (account.lastOrgSlug ?? null) !== slug)
            this.updateSlot(index, { ...account, lastOrgSlug: slug })
    }

    updateSlot(index: number, account: Account | null) {
        const slots = this.cache.slots.slice()
        while (slots.length <= index) slots.push(null)
        slots[index] = account
        this.set({ slots })
    }

    signIn(target: number, session: { token: string; user: User }) {
        const existing = this.cache.slots.findIndex((slot) => slot?.user.id === session.user.id)
        const index = existing !== -1 ? existing : target
        this.updateSlot(index, {
            token: session.token,
            user: session.user,
            lastOrgSlug: existing !== -1 ? (this.cache.slots[index]?.lastOrgSlug ?? null) : null,
        })
        return index
    }

    client(index: number, token: string | null): Client {
        const client = apiClient(this.baseUrl, () => token ?? undefined)
        client.interceptors.response.use((response) => {
            if (response.status === 401 && token && this.cache.slots[index]?.token === token)
                this.updateSlot(index, null)
            return response
        })
        return client
    }
}

export function firstHole(slots: (Account | null)[]) {
    const hole = slots.findIndex((slot) => slot === null)
    return hole === -1 ? slots.length : hole
}
