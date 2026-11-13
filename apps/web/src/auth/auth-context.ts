import { createContext, useContext } from 'react'
import type { Client, User } from '@fleet/client'
import type { Account, AuthStore } from './store'

export type Session =
    | { status: 'signed_out' }
    | { status: 'signed_in'; index: number; account: Account }

export interface AuthValue {
    session: Session
    accounts: (Account | null)[]
    maxAccounts: number
    signIn: (session: { token: string; user: User }) => number
    logout: (index?: number) => Promise<void>
    switchTo: (index: number) => void
    setLastOrg: (slug: string | null) => void
    api: Client
    anonymous: Client
}

export const AuthContext = createContext<AuthValue | null>(null)

export const AuthStoreContext = createContext<AuthStore | null>(null)

export function useAuthStore() {
    const store = useContext(AuthStoreContext)
    if (!store) throw new Error('useAuthStore requires AuthProvider')
    return store
}

export function useAuth() {
    const value = useContext(AuthContext)
    if (!value) throw new Error('useAuth requires AuthProvider')
    return value
}

export function useAccount() {
    const { session } = useAuth()
    if (session.status !== 'signed_in') throw new Error('useAccount requires a signed-in session')
    return session.account
}

type Person = { name: string; email: string }

export function displayName(user: Person) {
    return user.name.trim() || user.email
}

export function initials(user: Person) {
    return displayName(user)
        .split(/[\s@]+/)
        .filter(Boolean)
        .map((word) => [...word][0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
}
