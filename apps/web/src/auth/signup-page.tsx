import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { signupMutation } from '@fleet/client/react-query'
import { Input } from '../core/ui/input'
import { Button, Field, Spinner } from '../core/ui/primitives'
import { errorMessage, fieldError } from '../lib/api/errors'
import { useMessages } from '../i18n/provider'
import { useAuth } from './auth-context'
import { AppLink, AppNavigate } from './app-link'
import { AuthError, AuthQueryState, AuthScreen, AuthTitle, authLink } from './auth-screen'
import { instanceQuery } from './instance'
import { safeReturnTo, type LoginState } from './navigation'

export function SignupPage() {
    const { session, signIn, anonymous } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const t = useMessages()
    const text = t.auth.signup
    const instance = useQuery(instanceQuery(anonymous))
    const signup = useMutation(signupMutation({ client: anonymous }))
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const returnTo = safeReturnTo((location.state as LoginState | null)?.returnTo)
    if (session.status === 'signed_in') return <AppNavigate to={returnTo} replace />
    if (instance.data && instance.data.signup !== 'open')
        return <AppNavigate to="/login" replace state={location.state} />
    const nameError = fieldError(signup.error, 'name')
    const emailError = fieldError(signup.error, 'email')
    const passwordError = fieldError(signup.error, 'password')
    return (
        <AuthScreen>
            <AuthTitle>{text.title}</AuthTitle>
            {!instance.data ? (
                <AuthQueryState query={instance} />
            ) : (
                <form
                    className="flex flex-col gap-4.5"
                    aria-busy={signup.isPending}
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (signup.isPending) return
                        signup.mutate(
                            { body: { name: name.trim(), email: email.trim(), password } },
                            {
                                onSuccess: (data) => {
                                    signIn(data)
                                    navigate(returnTo, { replace: true })
                                },
                            },
                        )
                    }}
                >
                    <Field label={t.common.name} error={nameError}>
                        <Input
                            required
                            autoFocus
                            autoComplete="name"
                            maxLength={200}
                            value={name}
                            disabled={signup.isPending}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </Field>
                    <Field label={t.common.email} error={emailError}>
                        <Input
                            type="email"
                            required
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            value={email}
                            disabled={signup.isPending}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </Field>
                    <Field
                        label={t.common.password}
                        hint={t.auth.passwordHint}
                        error={passwordError}
                    >
                        <Input
                            type="password"
                            required
                            autoComplete="new-password"
                            value={password}
                            disabled={signup.isPending}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </Field>
                    <AuthError
                        error={
                            signup.error && !nameError && !emailError && !passwordError
                                ? errorMessage(signup.error, t)
                                : undefined
                        }
                    />
                    <Button type="submit" variant="default" size="lg" disabled={signup.isPending}>
                        {signup.isPending && <Spinner label={text.creating} />}
                        {text.create}
                    </Button>
                    <AppLink to="/login" state={location.state} className={authLink}>
                        {text.signIn}
                    </AppLink>
                </form>
            )}
        </AuthScreen>
    )
}
