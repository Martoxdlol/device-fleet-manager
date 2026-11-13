import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { InvitationPreview } from '@fleet/client'
import {
    acceptInvitationMutation,
    previewInvitationOptions,
    signupInvitedMutation,
} from '@fleet/client/react-query'
import { Input } from '../core/ui/input'
import { Button, Field, Spinner } from '../core/ui/primitives'
import { errorMessage, fieldError } from '../lib/api/errors'
import { organizationPath } from '../routing/paths'
import { useMessages } from '../i18n/provider'
import { useAuth } from './auth-context'
import { AuthError, AuthQueryState, AuthScreen, AuthTitle, authLink } from './auth-screen'
import type { LoginState } from './navigation'
import { instanceQuery } from './instance'
import { ProviderButtons, signInProviders } from './provider-sign-in'

export function InvitePage() {
    const { token = '' } = useParams()
    const { anonymous } = useAuth()
    const t = useMessages()
    const preview = useQuery({
        ...previewInvitationOptions({ client: anonymous, path: { token } }),
        staleTime: Infinity,
    })
    const invitation = preview.data
    return (
        <AuthScreen>
            <AuthTitle>
                {invitation ? t.auth.invite.title(invitation.org_name) : t.auth.invite.heading}
            </AuthTitle>
            {invitation ? (
                <Invitation token={token} invitation={invitation} />
            ) : (
                <AuthQueryState query={preview} />
            )}
        </AuthScreen>
    )
}

function Invitation({ token, invitation }: { token: string; invitation: InvitationPreview }) {
    const { session, api, anonymous, logout } = useAuth()
    const instance = useQuery(instanceQuery(anonymous))
    const navigate = useNavigate()
    const t = useMessages()
    const text = t.auth.invite
    const accept = useMutation(acceptInvitationMutation({ client: api }))
    const signInState: LoginState = { returnTo: `/invite/${encodeURIComponent(token)}` }
    const details = (
        <p className="text-[13px] text-muted-foreground">
            {text.details(invitation.email, t.organizations.roles[invitation.role])}
        </p>
    )
    if (session.status === 'signed_in') {
        const email = session.account.user.email
        if (email.toLowerCase() !== invitation.email.toLowerCase())
            return (
                <>
                    {details}
                    <p className="text-[13px]">{text.wrongAccount(email)}</p>
                    <Button size="lg" onClick={() => void logout()}>
                        {t.components.account.signOut}
                    </Button>
                </>
            )
        return (
            <>
                {details}
                <AuthError error={accept.error ? errorMessage(accept.error, t) : undefined} />
                <Button
                    variant="default"
                    size="lg"
                    disabled={accept.isPending}
                    onClick={() =>
                        accept.mutate(
                            { path: { token } },
                            { onSuccess: (org) => navigate(organizationPath(org)) },
                        )
                    }
                >
                    {accept.isPending && <Spinner label={text.accepting} />}
                    {text.accept}
                </Button>
            </>
        )
    }
    const signIn = () => navigate('/login', { state: signInState })
    if (invitation.account_exists)
        return (
            <>
                {details}
                <Button variant="default" size="lg" onClick={signIn}>
                    {text.signInToAccept}
                </Button>
            </>
        )
    return (
        <>
            {details}
            <InvitedSignup token={token} />
            <ProviderButtons
                client={anonymous}
                providers={signInProviders(instance.data?.providers)}
                returnTo={organizationPath({ slug: invitation.org_slug })}
                invitation={token}
            />
            <button type="button" className={`${authLink} self-start`} onClick={signIn}>
                {text.haveAccount}
            </button>
        </>
    )
}

function InvitedSignup({ token }: { token: string }) {
    const { anonymous, signIn } = useAuth()
    const navigate = useNavigate()
    const t = useMessages()
    const text = t.auth.invite
    const signup = useMutation(signupInvitedMutation({ client: anonymous }))
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const nameError = fieldError(signup.error, 'name')
    const passwordError = fieldError(signup.error, 'password')
    return (
        <form
            className="flex flex-col gap-4.5"
            aria-busy={signup.isPending}
            onSubmit={(event) => {
                event.preventDefault()
                if (signup.isPending) return
                signup.mutate(
                    { path: { token }, body: { name: name.trim(), password } },
                    {
                        onSuccess: (data) => {
                            signIn(data)
                            navigate(organizationPath(data.org), { replace: true })
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
            <Field label={t.common.password} hint={t.auth.passwordHint} error={passwordError}>
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
                    signup.error && !nameError && !passwordError
                        ? errorMessage(signup.error, t)
                        : undefined
                }
            />
            <Button type="submit" variant="default" size="lg" disabled={signup.isPending}>
                {signup.isPending && <Spinner label={text.joining} />}
                {text.createAndJoin}
            </Button>
        </form>
    )
}
