import { useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '../lib/api/query-client'
import { useAuth } from './auth-context'
import { AppNavigate } from './app-link'
import type { LoginState } from './navigation'
import { SessionGuard } from './session-guard'

export function RequireSession() {
    const { session, api } = useAuth()
    const location = useLocation()
    if (session.status === 'signed_out') {
        const state: LoginState = { returnTo: location.pathname + location.search }
        return <AppNavigate to="/login" replace state={state} />
    }
    return (
        <AccountTree key={session.account.user.id}>
            <SessionGuard api={api} index={session.index} account={session.account} />
            <Outlet />
        </AccountTree>
    )
}

function AccountTree({ children }: { children: ReactNode }) {
    const [client] = useState(createQueryClient)
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
