import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Member, OrgRole } from '@fleet/client'
import { displayName, initials, useAccount, useAuth } from '../../auth/auth-context'
import { Combobox } from '../../components/combobox'
import { ConfirmDialog } from '../../components/confirm-dialog'
import {
    DataTable,
    DataTableSearch,
    useDataTable,
    type DataColumn,
} from '../../components/data-table'
import { usePresentation } from '../../components/feedback/presentation-context'
import { RowAction } from '../../components/row-actions'
import { Button, Dialog } from '../../core/ui/primitives'
import { useMobile } from '../../core/scaffold/use-mobile'
import { useDebounced } from '../../hooks/use-debounced'
import { errorMessage } from '../../lib/api/errors'
import { usePagedList } from '../../lib/api/pagination'
import { rememberRoute } from '../../routing/resolution'
import { useRouteScope } from '../../routing/route-context'
import { LeaveOrganizationDialog } from '../organizations/leave-dialog'
import { OrganizationSettingsLayout } from '../organizations/settings-layout'
import { useFormat, useMessages } from '../../i18n/provider'
import { useMemberList, useRemoveMember, useUpdateMember } from './queries'
import { canManage, rolesFor } from './roles'

export function PersonAvatar({ person }: { person: { name: string; email: string } }) {
    return (
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold">
            {initials(person)}
        </span>
    )
}

export function MembersPage() {
    const { org } = useRouteScope()
    const { user } = useAccount()
    const { api } = useAuth()
    const cache = useQueryClient()
    const mobile = useMobile()
    const { notify } = usePresentation()
    const t = useMessages()
    const format = useFormat()
    const text = t.organizations.members
    const [search, setSearch] = useState('')
    const term = useDebounced(search.trim())
    const list = useMemberList(org.id, term)
    const { rows, pagination } = usePagedList(list)
    const [removing, setRemoving] = useState<Member | null>(null)
    const [leaving, setLeaving] = useState(false)
    const [ownRole, setOwnRole] = useState<{ row: Member; role: OrgRole } | null>(null)
    const update = useUpdateMember(org.id)
    const remove = useRemoveMember(org.id)

    const shownRole = (row: Member): OrgRole =>
        update.isPending && update.variables.path.user_id === row.user_id
            ? update.variables.body.role
            : row.role
    const applyRole = (row: Member, role: OrgRole) =>
        update.mutate(
            { path: { org_id: org.id, user_id: row.user_id }, body: { role } },
            {
                onSuccess: () => {
                    if (row.user_id === user.id) rememberRoute(api, cache, { ...org, role })
                },
                onError: (error) => notify(errorMessage(error, t), 'error'),
            },
        )

    const name: DataColumn<Member> = {
        key: 'name',
        header: t.common.name,
        width: mobile ? 200 : 240,
        pinned: 'left',
        hideable: false,
        cell: (row) => (
            <span className="flex min-w-0 items-center gap-2">
                <PersonAvatar person={row} />
                <span className="truncate">{mobile ? row.email : displayName(row)}</span>
                {row.user_id === user.id && (
                    <span className="shrink-0 text-muted-foreground">{text.you}</span>
                )}
            </span>
        ),
    }
    const role: DataColumn<Member> = {
        key: 'role',
        header: text.role,
        width: 150,
        hideable: false,
        cell: (row) =>
            canManage(org.role, row.role) ? (
                <Combobox
                    label={text.roleOf(row.email)}
                    searchable={false}
                    items={rolesFor(org.role)}
                    value={shownRole(row)}
                    onValueChange={(next) => {
                        if (!next || next === row.role) return
                        if (row.user_id === user.id) setOwnRole({ row, role: next })
                        else applyRole(row, next)
                    }}
                    getItemId={(item) => item}
                    getItemLabel={(item) => t.organizations.roles[item]}
                    className="-mx-2.5 w-full"
                    triggerClassName="border-transparent dark:bg-transparent hover:bg-muted"
                    disabled={update.isPending}
                />
            ) : (
                t.organizations.roles[row.role]
            ),
    }
    const actions: DataColumn<Member> = {
        key: 'actions',
        header: '',
        width: 48,
        minWidth: 48,
        pinned: 'right',
        hideable: false,
        resizable: false,
        cell: (row) =>
            row.user_id === user.id ? (
                <RowAction label={text.leave} icon="logout" onSelect={() => setLeaving(true)} />
            ) : canManage(org.role, row.role) ? (
                <RowAction
                    label={text.remove}
                    icon="trash"
                    destructive
                    onSelect={() => setRemoving(row)}
                />
            ) : null,
    }
    const columns: DataColumn<Member>[] = mobile
        ? [name, role, actions]
        : [
              name,
              {
                  key: 'email',
                  header: text.email,
                  width: 260,
                  cell: (row) => <span className="truncate">{row.email}</span>,
              },
              role,
              {
                  key: 'joined',
                  header: text.joined,
                  width: 140,
                  cell: (row) => format.date(row.joined_at),
              },
              actions,
          ]
    const table = useDataTable<Member>({
        columns,
        getRowId: (row) => row.user_id,
        selectable: false,
    })
    return (
        <OrganizationSettingsLayout
            section="members"
            fill
            toolbar={
                <DataTableSearch value={search} onChange={setSearch} placeholder={text.search} />
            }
        >
            <DataTable<Member>
                table={table}
                rows={rows}
                label={text.label}
                text={text.table}
                getRowLabel={(row) => row.email}
                loading={list.isPending}
                error={list.isError && !list.data ? list.error : undefined}
                onRetry={() => void list.refetch()}
                pagination={pagination}
                resetKey={term}
                emptyState={<p>{text.noMatch}</p>}
            />
            {removing && (
                <ConfirmDialog
                    title={text.removeTitle(displayName(removing))}
                    label={t.common.remove}
                    onClose={() => setRemoving(null)}
                    onConfirm={() =>
                        remove.mutateAsync({
                            path: { org_id: org.id, user_id: removing.user_id },
                        })
                    }
                />
            )}
            {leaving && (
                <LeaveOrganizationDialog organization={org} onClose={() => setLeaving(false)} />
            )}
            {ownRole && (
                <Dialog
                    open
                    onClose={() => setOwnRole(null)}
                    title={text.changeOwnRole(t.organizations.roles[ownRole.role])}
                >
                    <div className="flex justify-end gap-2">
                        <Button onClick={() => setOwnRole(null)}>{t.common.cancel}</Button>
                        <Button
                            variant="default"
                            onClick={() => {
                                applyRole(ownRole.row, ownRole.role)
                                setOwnRole(null)
                            }}
                        >
                            {text.changeRole}
                        </Button>
                    </div>
                </Dialog>
            )}
        </OrganizationSettingsLayout>
    )
}
