import { useState } from 'react'
import type { Invitation } from '@fleet/client'
import { ConfirmDialog } from '../../components/confirm-dialog'
import { LinkDialog } from '../../components/copy-field'
import { DataTable, useDataTable, type DataColumn } from '../../components/data-table'
import { RowAction } from '../../components/row-actions'
import { useMobile } from '../../core/scaffold/use-mobile'
import { usePagedList } from '../../lib/api/pagination'
import { invitationLink } from '../../routing/paths'
import { useRouteScope } from '../../routing/route-context'
import { OrganizationSettingsLayout } from '../organizations/settings-layout'
import { useFormat, useMessages } from '../../i18n/provider'
import { InviteDialog } from './invite-dialog'
import { useInvitations, useRevokeInvitation } from './queries'

export function InvitationsPage() {
    const { org } = useRouteScope()
    const mobile = useMobile()
    const t = useMessages()
    const format = useFormat()
    const text = t.organizations.invitations
    const list = useInvitations(org.id)
    const { rows, pagination } = usePagedList(list)
    const revoke = useRevokeInvitation(org.id)
    const [inviting, setInviting] = useState(false)
    const [invited, setInvited] = useState<{ email: string; token: string } | null>(null)
    const [revoking, setRevoking] = useState<Invitation | null>(null)
    const email: DataColumn<Invitation> = {
        key: 'email',
        header: text.email,
        width: mobile ? 200 : 260,
        pinned: 'left',
        hideable: false,
        cell: (row) => <span className="truncate">{row.email}</span>,
    }
    const role: DataColumn<Invitation> = {
        key: 'role',
        header: text.role,
        width: 130,
        hideable: false,
        cell: (row) => t.organizations.roles[row.role],
    }
    const actions: DataColumn<Invitation> = {
        key: 'actions',
        header: '',
        width: 48,
        minWidth: 48,
        pinned: 'right',
        hideable: false,
        resizable: false,
        cell: (row) => (
            <RowAction
                label={text.revoke}
                icon="close"
                destructive
                onSelect={() => setRevoking(row)}
            />
        ),
    }
    const columns: DataColumn<Invitation>[] = mobile
        ? [email, role, actions]
        : [
              email,
              role,
              {
                  key: 'expires',
                  header: text.expires,
                  width: 160,
                  cell: (row) => format.dateTime(row.expires_at),
              },
              actions,
          ]
    const table = useDataTable<Invitation>({
        columns,
        getRowId: (row) => row.id,
        selectable: false,
    })
    return (
        <OrganizationSettingsLayout
            section="invitations"
            fill
            actions={[
                {
                    id: 'invite',
                    label: text.invite,
                    icon: 'invite',
                    onSelect: () => setInviting(true),
                },
            ]}
        >
            <DataTable<Invitation>
                table={table}
                rows={rows}
                label={text.label}
                text={text.table}
                getRowLabel={(row) => row.email}
                loading={list.isPending}
                error={list.isError && !list.data ? list.error : undefined}
                onRetry={() => void list.refetch()}
                pagination={pagination}
                emptyState={<p>{text.empty}</p>}
            />
            {inviting && (
                <InviteDialog
                    org={org}
                    onClose={() => setInviting(false)}
                    onInvited={(next) => {
                        setInviting(false)
                        setInvited(next)
                    }}
                />
            )}
            {invited && (
                <LinkDialog
                    title={text.linkTitle(invited.email)}
                    hint={text.linkHint}
                    link={invitationLink(invited.token)}
                    onClose={() => setInvited(null)}
                />
            )}
            {revoking && (
                <ConfirmDialog
                    title={text.revokeTitle(revoking.email)}
                    label={text.revoke}
                    onClose={() => setRevoking(null)}
                    onConfirm={() =>
                        revoke.mutateAsync({
                            path: { org_id: org.id, invitation_id: revoking.id },
                        })
                    }
                />
            )}
        </OrganizationSettingsLayout>
    )
}
