import { useRef, useState } from 'react'
import type { AgentKey } from '@fleet/client'
import { useAppNavigate } from '../../auth/navigation'
import { Combobox } from '../../components/combobox'
import { ConfirmDialog } from '../../components/confirm-dialog'
import { SlugInput } from '../../components/forms/name-slug-fields'
import { isSlug } from '../../components/forms/resource-slug'
import { Input } from '../../core/ui/input'
import { Button, Field, Surface } from '../../core/ui/primitives'
import { errorMessage, fieldError } from '../../lib/api/errors'
import { fleetSettingsPath, organizationPath } from '../../routing/paths'
import { useFleetScope } from '../../routing/route-context'
import { useKeyOptions } from '../agent-keys/queries'
import { useMessages } from '../../i18n/provider'
import { useDeleteFleet, useUpdateFleet } from './queries'
import { FleetSettingsLayout } from './settings-layout'

export function FleetGeneralSettingsPage() {
    const { org, fleet } = useFleetScope()
    return <FleetGeneralSettings key={fleet.id} org={org} fleet={fleet} />
}

function FleetGeneralSettings({ org, fleet }: ReturnType<typeof useFleetScope>) {
    const [name, setName] = useState(fleet.name)
    const [slug, setSlug] = useState(fleet.slug)
    const [picked, setPicked] = useState<AgentKey | null>(null)
    const [deleting, setDeleting] = useState(false)
    const form = useRef<HTMLFormElement>(null)
    const keys = useKeyOptions(org.id)
    const update = useUpdateFleet(org, fleet)
    const remove = useDeleteFleet(org, fleet)
    const navigate = useAppNavigate()
    const t = useMessages()
    const text = t.fleets.settings
    const [current, setCurrent] = useState<AgentKey | null>(null)
    const loaded = keys.items.find((key) => key.id === fleet.agent_key_id)
    if (loaded && loaded !== current) setCurrent(loaded)
    const key = picked ?? (current?.id === fleet.agent_key_id ? current : null)
    const keyChanged = !!picked && picked.id !== fleet.agent_key_id
    const changed = name.trim() !== fleet.name || slug !== fleet.slug || keyChanged
    const valid = !!name.trim() && isSlug(slug)
    const nameError = fieldError(update.error, 'name')
    const slugError = fieldError(update.error, 'slug')
    const keyError = fieldError(update.error, 'agent_key_id')
    return (
        <FleetSettingsLayout
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
                                    path: { fleet_id: fleet.id },
                                    body: {
                                        ...(name.trim() !== fleet.name
                                            ? { name: name.trim() }
                                            : {}),
                                        ...(slug !== fleet.slug ? { slug } : {}),
                                        ...(keyChanged ? { agent_key_id: picked.id } : {}),
                                    },
                                },
                                {
                                    onSuccess: (updated) => {
                                        setPicked(null)
                                        if (updated.slug !== fleet.slug)
                                            navigate(fleetSettingsPath(org, updated), {
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
                                prefix={`${window.location.host}${organizationPath(org)}/`}
                                value={slug}
                                onChange={setSlug}
                                disabled={update.isPending}
                                invalid={!!slugError || !isSlug(slug)}
                            />
                        </Field>
                        <Field label={text.agentKey} hint={text.agentKeyHint} error={keyError}>
                            <Combobox<AgentKey>
                                {...keys}
                                label={text.agentKey}
                                value={key}
                                onValueChange={(next) => {
                                    if (next) setPicked(next)
                                }}
                                getItemId={(item) => item.id}
                                getItemLabel={(item) => item.name}
                                disabled={update.isPending}
                            />
                        </Field>
                        {update.error && !slugError && !nameError && !keyError && (
                            <p role="alert" className="text-xs text-destructive">
                                {errorMessage(update.error, t)}
                            </p>
                        )}
                    </form>
                </Surface>
                <Surface className="p-[25px] app-max-md:p-4.5">
                    <Button variant="destructive" onClick={() => setDeleting(true)}>
                        {text.delete}
                    </Button>
                </Surface>
            </div>
            {deleting && (
                <ConfirmDialog
                    title={text.deleteTitle(fleet.name)}
                    typed={fleet.slug}
                    onClose={() => setDeleting(false)}
                    onConfirm={async () => {
                        await remove.mutateAsync({ path: { fleet_id: fleet.id } })
                        navigate(organizationPath(org), { replace: true })
                    }}
                />
            )}
        </FleetSettingsLayout>
    )
}
