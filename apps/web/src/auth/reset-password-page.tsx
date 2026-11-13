import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { resetPasswordMutation } from '@fleet/client/react-query'
import { Input } from '../core/ui/input'
import { Button, Field, Spinner } from '../core/ui/primitives'
import { errorMessage, fieldError } from '../lib/api/errors'
import { useMessages } from '../i18n/provider'
import { useAuth } from './auth-context'
import { AppLink } from './app-link'
import { AuthError, AuthScreen, AuthTitle, authLink } from './auth-screen'

export function ResetPasswordPage() {
    const [params] = useSearchParams()
    const token = params.get('token') ?? ''
    const { signIn, anonymous } = useAuth()
    const navigate = useNavigate()
    const t = useMessages()
    const text = t.auth.reset
    const reset = useMutation(resetPasswordMutation({ client: anonymous }))
    const [password, setPassword] = useState('')
    const passwordError = fieldError(reset.error, 'password')
    return (
        <AuthScreen>
            <AuthTitle>{text.title}</AuthTitle>
            {!token ? (
                <>
                    <p className="text-[13px] text-muted-foreground">{text.missingToken}</p>
                    <AppLink to="/login" className={authLink}>
                        {t.auth.login.signIn}
                    </AppLink>
                </>
            ) : (
                <form
                    className="flex flex-col gap-4.5"
                    aria-busy={reset.isPending}
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (reset.isPending) return
                        reset.mutate(
                            { body: { token, password } },
                            {
                                onSuccess: (data) => {
                                    signIn(data)
                                    navigate('/', { replace: true })
                                },
                            },
                        )
                    }}
                >
                    <Field label={text.password} hint={t.auth.passwordHint} error={passwordError}>
                        <Input
                            type="password"
                            required
                            autoFocus
                            autoComplete="new-password"
                            value={password}
                            disabled={reset.isPending}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </Field>
                    <AuthError
                        error={
                            reset.error && !passwordError ? errorMessage(reset.error, t) : undefined
                        }
                    />
                    <Button type="submit" variant="default" size="lg" disabled={reset.isPending}>
                        {reset.isPending && <Spinner label={text.saving} />}
                        {text.save}
                    </Button>
                </form>
            )}
        </AuthScreen>
    )
}
