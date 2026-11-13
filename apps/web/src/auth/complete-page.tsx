import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { exchangeCode } from '@fleet/client'
import { Spinner } from '../core/ui/primitives'
import { useMessages } from '../i18n/provider'
import { AppLink } from './app-link'
import { AuthError, AuthScreen, AuthTitle, authLink } from './auth-screen'
import { useAuth } from './auth-context'
import { safeReturnTo } from './navigation'
import { clearPending, readPending } from './provider-sign-in'

const knownErrors = [
    'state_invalid',
    'provider_denied',
    'provider_failed',
    'no_account',
    'email_taken',
    'email_unverified',
    'identity_taken',
    'provider_already_linked',
    'invitation_invalid',
] as const

type CompleteError = (typeof knownErrors)[number] | 'unavailable' | 'expired'

function asError(value: string | null): CompleteError | null {
    if (value === null) return null
    return (knownErrors as readonly string[]).includes(value)
        ? (value as CompleteError)
        : 'unavailable'
}

export function CompletePage() {
    const [params] = useSearchParams()
    const code = params.get('code')
    const navigate = useNavigate()
    const { anonymous, signIn } = useAuth()
    const t = useMessages()
    const [pending] = useState(readPending)
    const [failed, setFailed] = useState<CompleteError | null>(
        () => asError(params.get('error')) ?? (!code || !pending ? 'expired' : null),
    )
    const returnTo = safeReturnTo(pending?.returnTo)

    useEffect(() => {
        if (failed || !code || !pending) return
        let cancelled = false
        exchangeCode({
            client: anonymous,
            body: { code, code_verifier: pending.codeVerifier },
            throwOnError: true,
        })
            .then(({ data }) => {
                if (cancelled) return
                clearPending()
                signIn(data)
                navigate(returnTo, { replace: true })
            })
            .catch(() => {
                if (!cancelled) setFailed('expired')
            })
        return () => {
            cancelled = true
        }
    }, [anonymous, code, failed, navigate, pending, returnTo, signIn])

    if (!failed)
        return (
            <main className="h-(--viewport-height) grid place-items-center p-6 bg-background">
                <Spinner label={t.auth.login.signingIn} />
            </main>
        )
    return (
        <AuthScreen>
            <AuthTitle>{t.auth.complete.title}</AuthTitle>
            <AuthError error={t.auth.complete.errors[failed]} />
            <AppLink to="/login" className={`${authLink} self-start`}>
                {t.auth.complete.back}
            </AppLink>
        </AuthScreen>
    )
}
