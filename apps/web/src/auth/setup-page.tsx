import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { setupMutation } from '@fleet/client/react-query'
import { NameSlugFields } from '../components/forms/name-slug-fields'
import { useNameSlug } from '../components/forms/use-name-slug'
import { Input } from '../core/ui/input'
import { Button, Field, Spinner } from '../core/ui/primitives'
import { errorMessage, fieldError } from '../lib/api/errors'
import { organizationPath } from '../routing/paths'
import { useMessages } from '../i18n/provider'
import { useAuth } from './auth-context'
import { AppLink } from './app-link'
import { AuthError, AuthQueryState, AuthScreen, AuthTitle, authLink } from './auth-screen'
import { instanceQuery } from './instance'

export function SetupPage() {
    const [params] = useSearchParams()
    const token = params.get('token') ?? ''
    const { signIn, anonymous } = useAuth()
    const navigate = useNavigate()
    const t = useMessages()
    const text = t.auth.setup
    const instance = useQuery(instanceQuery(anonymous))
    const setup = useMutation(setupMutation({ client: anonymous }))
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const org = useNameSlug()
    const errors = {
        email: fieldError(setup.error, 'email'),
        name: fieldError(setup.error, 'name'),
        password: fieldError(setup.error, 'password'),
        orgName: fieldError(setup.error, 'org_name'),
        orgSlug: fieldError(setup.error, 'org_slug'),
    }
    const fieldErrors = Object.values(errors).some(Boolean)
    const unavailable = !token || instance.data?.setup_required === false
    return (
        <AuthScreen>
            <AuthTitle>{text.title}</AuthTitle>
            {!instance.data ? (
                <AuthQueryState query={instance} />
            ) : unavailable ? (
                <>
                    <p className="text-[13px] text-muted-foreground">
                        {token ? text.done : text.missingToken}
                    </p>
                    <AppLink to="/login" className={authLink}>
                        {t.auth.login.signIn}
                    </AppLink>
                </>
            ) : (
                <form
                    className="flex flex-col gap-4.5"
                    aria-busy={setup.isPending}
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (setup.isPending || !org.valid) return
                        setup.mutate(
                            {
                                body: {
                                    token,
                                    email: email.trim(),
                                    name: name.trim(),
                                    password,
                                    org_name: org.name.trim(),
                                    org_slug: org.slug,
                                },
                            },
                            {
                                onSuccess: (data) => {
                                    signIn(data)
                                    navigate(organizationPath(data.org), { replace: true })
                                },
                            },
                        )
                    }}
                >
                    <Field label={t.common.email} error={errors.email}>
                        <Input
                            type="email"
                            required
                            autoFocus
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            value={email}
                            disabled={setup.isPending}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </Field>
                    <Field label={t.common.name} error={errors.name}>
                        <Input
                            required
                            autoComplete="name"
                            maxLength={200}
                            value={name}
                            disabled={setup.isPending}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </Field>
                    <Field
                        label={t.common.password}
                        hint={t.auth.passwordHint}
                        error={errors.password}
                    >
                        <Input
                            type="password"
                            required
                            autoComplete="new-password"
                            value={password}
                            disabled={setup.isPending}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </Field>
                    <NameSlugFields
                        state={org}
                        urlPrefix="/"
                        nameLabel={text.organization}
                        nameError={errors.orgName}
                        slugError={errors.orgSlug}
                        disabled={setup.isPending}
                    />
                    <AuthError
                        error={
                            setup.error && !fieldErrors ? errorMessage(setup.error, t) : undefined
                        }
                    />
                    <Button
                        type="submit"
                        variant="default"
                        size="lg"
                        disabled={setup.isPending || !org.valid}
                    >
                        {setup.isPending && <Spinner label={text.creating} />}
                        {text.create}
                    </Button>
                </form>
            )}
        </AuthScreen>
    )
}
