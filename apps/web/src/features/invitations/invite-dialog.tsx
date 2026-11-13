import { useState } from 'react'
import type { MyOrganization, OrgRole } from '@fleet/client'
import { Combobox } from '../../components/combobox'
import { Input } from '../../core/ui/input'
import { Button, Dialog, Field, Spinner } from '../../core/ui/primitives'
import { errorMessage, fieldError } from '../../lib/api/errors'
import { rolesFor } from '../members/roles'
import { useMessages } from '../../i18n/provider'
import { useInvite } from './queries'

export function InviteDialog({
    org,
    onClose,
    onInvited,
}: {
    org: MyOrganization
    onClose: () => void
    onInvited: (invited: { email: string; token: string }) => void
}) {
    const [email, setEmail] = useState('')
    const [role, setRole] = useState<OrgRole>('member')
    const invite = useInvite(org.id)
    const t = useMessages()
    const text = t.organizations.invitations
    const emailError = fieldError(invite.error, 'email')
    return (
        <Dialog
            open
            onClose={() => {
                if (!invite.isPending) onClose()
            }}
            title={text.inviteTo(org.name)}
        >
            <form
                className="flex flex-col gap-4.5"
                aria-busy={invite.isPending}
                onSubmit={(event) => {
                    event.preventDefault()
                    if (!email.trim() || invite.isPending) return
                    invite.mutate(
                        { path: { org_id: org.id }, body: { email: email.trim(), role } },
                        {
                            onSuccess: (created) =>
                                onInvited({
                                    email: created.invitation.email,
                                    token: created.token,
                                }),
                        },
                    )
                }}
            >
                <Field label={text.email} error={emailError}>
                    <Input
                        type="email"
                        required
                        autoFocus
                        autoCapitalize="none"
                        spellCheck={false}
                        value={email}
                        disabled={invite.isPending}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </Field>
                <Field label={text.role}>
                    <Combobox
                        label={text.role}
                        searchable={false}
                        items={rolesFor(org.role)}
                        value={role}
                        onValueChange={(value) => {
                            if (value) setRole(value)
                        }}
                        getItemId={(item) => item}
                        getItemLabel={(item) => t.organizations.roles[item]}
                        disabled={invite.isPending}
                    />
                </Field>
                {invite.error != null && !emailError && (
                    <p role="alert" className="text-xs text-destructive">
                        {errorMessage(invite.error, t)}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} disabled={invite.isPending}>
                        {t.common.cancel}
                    </Button>
                    <Button
                        type="submit"
                        variant="default"
                        disabled={!email.trim() || invite.isPending}
                    >
                        {invite.isPending && <Spinner label={text.inviting} />}
                        {text.invite}
                    </Button>
                </div>
            </form>
        </Dialog>
    )
}
