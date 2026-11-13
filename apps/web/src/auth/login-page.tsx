import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { loginMutation } from '@fleet/client/react-query'
import { Input } from '../core/ui/input'
import { Button, Field, Spinner } from '../core/ui/primitives'
import { errorMessage } from '../lib/api/errors'
import { useMessages } from '../i18n/provider'
import { useAuth } from './auth-context'
import { AppLink, AppNavigate } from './app-link'
import { AuthError, AuthQueryState, AuthScreen, AuthTitle, authLink } from './auth-screen'
import { maxAccounts } from './config'
import { instanceQuery } from './instance'
import { carryAuthUser, safeReturnTo, type LoginState } from './navigation'
import { ProviderButtons, signInProviders } from './provider-sign-in'

export function LoginPage() {
    const { session, signIn, anonymous } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const t = useMessages()
    const text = t.auth.login
    const instance = useQuery(instanceQuery(anonymous))
    const login = useMutation(loginMutation({ client: anonymous }))
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const returnTo = safeReturnTo((location.state as LoginState | null)?.returnTo)
    if (session.status === 'signed_in') return <AppNavigate to={returnTo} replace />
    return (
        <AuthScreen>
            <AuthTitle>{text.title}</AuthTitle>
            {!instance.data ? (
                <AuthQueryState query={instance} />
            ) : instance.data.setup_required ? (
                <p className="text-[13px] text-muted-foreground">{text.setupPending}</p>
            ) : (
                <form
                    className="flex flex-col gap-4.5"
                    aria-busy={login.isPending}
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (login.isPending) return
                        login.mutate(
                            { body: { email: email.trim(), password } },
                            {
                                onSuccess: (data) => {
                                    const slot = signIn(data)
                                    navigate(
                                        carryAuthUser(
                                            returnTo,
                                            slot > 0 && maxAccounts > 1 ? String(slot) : null,
                                        ),
                                        { replace: true },
                                    )
                                },
                            },
                        )
                    }}
                >
                    <Field label={t.common.email}>
                        <Input
                            type="email"
                            required
                            autoFocus
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            value={email}
                            disabled={login.isPending}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </Field>
                    <Field label={t.common.password}>
                        <Input
                            type="password"
                            required
                            autoComplete="current-password"
                            value={password}
                            disabled={login.isPending}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </Field>
                    <AuthError error={login.error ? errorMessage(login.error, t) : undefined} />
                    <Button type="submit" variant="default" size="lg" disabled={login.isPending}>
                        {login.isPending && <Spinner label={text.signingIn} />}
                        {text.signIn}
                    </Button>
                    <ProviderButtons
                        client={anonymous}
                        providers={signInProviders(instance.data.providers)}
                        returnTo={returnTo}
                    />
                    {instance.data.signup === 'open' && (
                        <AppLink to="/signup" state={location.state} className={authLink}>
                            {text.createAccount}
                        </AppLink>
                    )}
                </form>
            )}
        </AuthScreen>
    )
}
