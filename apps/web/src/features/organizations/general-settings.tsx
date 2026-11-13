import { useRef, useState } from 'react'
import { useAppNavigate } from '../../auth/navigation'
import { ConfirmDialog } from '../../components/confirm-dialog'
import { SlugInput } from '../../components/forms/name-slug-fields'
import { isSlug } from '../../components/forms/resource-slug'
import { Input } from '../../core/ui/input'
import { Button, Field, Surface } from '../../core/ui/primitives'
import { errorMessage, fieldError } from '../../lib/api/errors'
import { organizationSettingsPath } from '../../routing/paths'
import { useRouteScope } from '../../routing/route-context'
import { useMessages } from '../../i18n/provider'
import { useDeleteOrganization, useUpdateOrganization } from './queries'
import { OrganizationSettingsLayout } from './settings-layout'

export function GeneralSettingsPage() {
    const { org } = useRouteScope()
    const [name, setName] = useState(org.name)
    const [slug, setSlug] = useState(org.slug)
    const [deleting, setDeleting] = useState(false)
    const form = useRef<HTMLFormElement>(null)
    const update = useUpdateOrganization(org)
    const remove = useDeleteOrganization(org)
    const navigate = useAppNavigate()
    const t = useMessages()
    const text = t.organizations.general
    const changed = name.trim() !== org.name || slug !== org.slug
    const valid = !!name.trim() && isSlug(slug)
    const nameError = fieldError(update.error, 'name')
    const slugError = fieldError(update.error, 'slug')
    return (
        <OrganizationSettingsLayout
            section="general"
            actions={[
                {
                    id: 'save',
                    label: t.common.save,
                    icon: 'save',
                    disabled: !changed || !valid || update.isPending,
                    onSelect: () => form.current?.requestSubmit(),
                },
            ]}
        >
            <div className="flex flex-col gap-(--space-gap)">
                <Surface className="p-[25px] app-max-md:p-4.5">
                    <form
                        ref={form}
                        className="flex flex-col gap-4.5"
                        onSubmit={(event) => {
                            event.preventDefault()
                            if (!changed || !valid || update.isPending) return
                            update.mutate(
                                {
                                    path: { org_id: org.id },
                                    body: {
                                        ...(name.trim() !== org.name ? { name: name.trim() } : {}),
                                        ...(slug !== org.slug ? { slug } : {}),
                                    },
                                },
                                {
                                    onSuccess: (updated) => {
                                        if (updated.slug !== org.slug)
                                            navigate(organizationSettingsPath(updated), {
                                                replace: true,
                                            })
                                    },
                                },
                            )
                        }}
                    >
                        <Field label={t.common.name} error={nameError}>
                            <Input
                                required
                                maxLength={200}
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                disabled={update.isPending}
                            />
                        </Field>
                        <Field
                            label={t.components.forms.url}
                            hint={text.slugHint}
                            error={slugError}
                        >
                            <SlugInput
                                prefix={`${window.location.host}/`}
                                value={slug}
                                onChange={setSlug}
                                disabled={update.isPending}
                                invalid={!!slugError || !isSlug(slug)}
                            />
                        </Field>
                        {update.error && !slugError && !nameError && (
                            <p role="alert" className="text-xs text-destructive">
                                {errorMessage(update.error, t)}
                            </p>
                        )}
                    </form>
                </Surface>
                {org.role === 'owner' && (
                    <Surface className="p-[25px] app-max-md:p-4.5">
                        <Button variant="destructive" onClick={() => setDeleting(true)}>
                            {text.delete}
                        </Button>
                    </Surface>
                )}
            </div>
            {deleting && (
                <ConfirmDialog
                    title={text.deleteTitle(org.name)}
                    typed={org.slug}
                    onClose={() => setDeleting(false)}
                    onConfirm={async () => {
                        await remove.mutateAsync({ path: { org_id: org.id } })
                        navigate('/', { replace: true })
                    }}
                />
            )}
        </OrganizationSettingsLayout>
    )
}
