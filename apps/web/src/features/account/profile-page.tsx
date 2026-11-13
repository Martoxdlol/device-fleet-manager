import { useRef, useState } from 'react'
import { useAccount } from '../../auth/auth-context'
import { usePresentation } from '../../components/feedback/presentation-context'
import { PageLayout } from '../../components/layout/page-layout'
import { PageContent } from '../../core/scaffold/scaffold'
import { Input } from '../../core/ui/input'
import { Button, Field, Spinner, Surface } from '../../core/ui/primitives'
import { errorMessage, fieldError } from '../../lib/api/errors'
import { useMessages } from '../../i18n/provider'
import { useChangePassword, useUpdateMe } from './queries'
import { SignInMethods } from './sign-in-methods'

export function ProfilePage() {
    const { user } = useAccount()
    const t = useMessages()
    const text = t.account.profile
    const { notify } = usePresentation()
    const [name, setName] = useState(user.name)
    const [current, setCurrent] = useState('')
    const [next, setNext] = useState('')
    const form = useRef<HTMLFormElement>(null)
    const update = useUpdateMe()
    const password = useChangePassword()
    const changed = !!name.trim() && name.trim() !== user.name
    const nameError = fieldError(update.error, 'name')
    const currentError = fieldError(password.error, 'current_password')
    const nextError = fieldError(password.error, 'new_password')
    return (
        <PageLayout
            title={text.title}
            actions={[
                {
                    id: 'save',
                    label: t.common.save,
                    icon: 'save',
                    disabled: !changed || update.isPending,
                    onSelect: () => form.current?.requestSubmit(),
                },
            ]}
        >
            <PageContent width="settings">
                <div className="flex flex-col gap-(--space-gap)">
                    <Surface className="p-[25px] app-max-md:p-4.5">
                        <form
                            ref={form}
                            className="flex flex-col gap-4.5"
                            onSubmit={(event) => {
                                event.preventDefault()
                                if (!changed || update.isPending) return
                                update.mutate({ body: { name: name.trim() } })
                            }}
                        >
                            <Field label={t.common.name} error={nameError}>
                                <Input
                                    required
                                    maxLength={200}
                                    autoComplete="name"
                                    value={name}
                                    disabled={update.isPending}
                                    onChange={(event) => setName(event.target.value)}
                                />
                            </Field>
                            <Field label={t.common.email}>
                                <Input readOnly value={user.email} />
                            </Field>
                            {update.error && !nameError && (
                                <p role="alert" className="text-xs text-destructive">
                                    {errorMessage(update.error, t)}
                                </p>
                            )}
                        </form>
                    </Surface>
                    <Surface className="p-[25px] app-max-md:p-4.5">
                        <form
                            className="flex flex-col gap-4.5"
                            onSubmit={(event) => {
                                event.preventDefault()
                                if ((user.has_password && !current) || !next || password.isPending)
                                    return
                                password.mutate(
                                    {
                                        body: {
                                            current_password: user.has_password ? current : null,
                                            new_password: next,
                                        },
                                    },
                                    {
                                        onSuccess: () => {
                                            setCurrent('')
                                            setNext('')
                                            notify(text.passwordChanged)
                                        },
                                    },
                                )
                            }}
                        >
                            {user.has_password && (
                                <Field label={text.currentPassword} error={currentError}>
                                    <Input
                                        type="password"
                                        required
                                        autoComplete="current-password"
                                        value={current}
                                        disabled={password.isPending}
                                        onChange={(event) => setCurrent(event.target.value)}
                                    />
                                </Field>
                            )}
                            <Field
                                label={text.newPassword}
                                hint={text.passwordHint}
                                error={nextError}
                            >
                                <Input
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    value={next}
                                    disabled={password.isPending}
                                    onChange={(event) => setNext(event.target.value)}
                                />
                            </Field>
                            {password.error && !currentError && !nextError && (
                                <p role="alert" className="text-xs text-destructive">
                                    {errorMessage(password.error, t)}
                                </p>
                            )}
                            <Button
                                type="submit"
                                className="self-start"
                                disabled={
                                    (user.has_password && !current) || !next || password.isPending
                                }
                            >
                                {password.isPending && <Spinner label={text.changing} />}
                                {user.has_password ? text.changePassword : text.setPassword}
                            </Button>
                        </form>
                    </Surface>
                    <SignInMethods />
                </div>
            </PageContent>
        </PageLayout>
    )
}
