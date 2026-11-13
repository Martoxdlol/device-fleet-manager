import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Outlet, useSearchParams } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { logout as logoutCall } from '@fleet/client'
import { createQueryClient } from '../lib/api/query-client'
import { AuthContext, AuthStoreContext, type AuthValue } from './auth-context'
import { AuthStore, type Account } from './store'
import { AUTH_USER_PARAM, parseAuthUser } from './navigation'
import { maxAccounts } from './config'

function resolveIndex(requested: number | null, slots: (Account | null)[]) {
    if (requested !== null && requested < maxAccounts && slots[requested]) return requested
    const lowest = slots.findIndex((slot) => slot !== null)
    return lowest === -1 ? 0 : Math.min(lowest, maxAccounts - 1)
}

function withAuthUser(params: URLSearchParams, index: number) {
    params.delete(AUTH_USER_PARAM)
    if (index > 0) params.set(AUTH_USER_PARAM, String(index))
    return params
}

export function AuthProvider() {
    const [store] = useState(() => new AuthStore(window.location.origin))
    const [publicCache] = useState(createQueryClient)
    const state = useSyncExternalStore(store.subscribe, store.get, store.get)
    const [searchParams, setSearchParams] = useSearchParams()
    const requested = parseAuthUser(searchParams.get(AUTH_USER_PARAM))
    const index = resolveIndex(requested, state.slots)
    const account = state.slots[index] ?? null

    useEffect(() => {
        if (requested === null || (requested === index && index > 0)) return
        setSearchParams((prev) => withAuthUser(prev, index), { replace: true })
    }, [requested, index, setSearchParams])

    const token = account?.token ?? null
    const api = useMemo(() => store.client(index, token), [store, token, index])
    const anonymous = useMemo(() => store.client(index, null), [store, index])

    const setLastOrg = useCallback(
        (slug: string | null) => store.setLastOrg(index, slug),
        [store, index],
    )
    const slots = state.slots
    const value = useMemo<AuthValue>(
        () => ({
            session: account ? { status: 'signed_in', index, account } : { status: 'signed_out' },
            accounts: slots,
            maxAccounts,
            signIn: (session) => store.signIn(index, session),
            async logout(target = index) {
                const victim = slots[target]
                if (!victim) return
                try {
                    await logoutCall({
                        client: target === index ? api : store.client(target, victim.token),
                    })
                } catch {}
                store.updateSlot(target, null)
            },
            switchTo(target) {
                if (maxAccounts > 1 && slots[target])
                    setSearchParams((prev) => withAuthUser(prev, target))
            },
            setLastOrg,
            api,
            anonymous,
        }),
        [store, slots, account, index, api, anonymous, setSearchParams, setLastOrg],
    )

    return (
        <AuthStoreContext value={store}>
            <AuthContext value={value}>
                <QueryClientProvider client={publicCache}>
                    <Outlet />
                </QueryClientProvider>
            </AuthContext>
        </AuthStoreContext>
    )
}
