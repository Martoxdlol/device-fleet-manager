import { useMutation } from '@tanstack/react-query'
import type { Client, Provider } from '@fleet/client'
import { startOidc } from '@fleet/client'
import { Button, Spinner } from '../core/ui/primitives'
import { errorMessage } from '../lib/api/errors'
import { useMessages } from '../i18n/provider'
import { AuthError } from './auth-screen'
import { challenge, randomVerifier } from './pkce'

const PENDING_KEY = 'fleet.auth.pending'

export type SignInProvider = Exclude<Provider, 'password'>

export interface PendingSignIn {
    codeVerifier: string
    returnTo: string
}

export function readPending(): PendingSignIn | null {
    try {
        const value = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null')
        return typeof value?.codeVerifier === 'string' && typeof value?.returnTo === 'string'
            ? value
            : null
    } catch {
        return null
    }
}

export function clearPending() {
    sessionStorage.removeItem(PENDING_KEY)
}

export function signInProviders(providers: Provider[] | undefined): SignInProvider[] {
    return (providers ?? []).filter(
        (provider): provider is SignInProvider => provider !== 'password',
    )
}

export function useProviderSignIn(client: Client) {
    return useMutation({
        mutationFn: async ({
            provider,
            returnTo,
            invitation,
        }: {
            provider: SignInProvider
            returnTo: string
            invitation?: string
        }) => {
            const codeVerifier = randomVerifier()
            const { data } = await startOidc({
                client,
                path: { provider },
                body: {
                    code_challenge: await challenge(codeVerifier),
                    return_to: returnTo,
                    invitation,
                },
                throwOnError: true,
            })
            sessionStorage.setItem(PENDING_KEY, JSON.stringify({ codeVerifier, returnTo }))
            window.location.assign(data.url)
        },
    })
}

export function ProviderButtons({
    client,
    providers,
    returnTo,
    invitation,
}: {
    client: Client
    providers: SignInProvider[]
    returnTo: string
    invitation?: string
}) {
    const t = useMessages()
    const start = useProviderSignIn(client)
    if (!providers.length) return null
    return (
        <div className="flex flex-col gap-2">
            {providers.map((provider) => (
                <Button
                    key={provider}
                    size="lg"
                    disabled={start.isPending}
                    onClick={() => start.mutate({ provider, returnTo, invitation })}
                >
                    {start.isPending && start.variables?.provider === provider && (
                        <Spinner label={t.auth.providers.redirecting} />
                    )}
                    {t.auth.providers.continueWith(t.auth.providers.names[provider])}
                </Button>
            ))}
            <AuthError error={start.error ? errorMessage(start.error, t) : undefined} />
        </div>
    )
}
