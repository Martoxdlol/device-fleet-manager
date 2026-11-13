import { useState } from 'react'
import type { Group, Member } from '@fleet/client'
import { MultiCombobox } from '../../components/combobox'
import { ConfirmDialog } from '../../components/confirm-dialog'
import { DataTable, useDataTable, type DataColumn } from '../../components/data-table'
import { usePresentation } from '../../components/feedback/presentation-context'
import { NameDialog } from '../../components/forms/name-dialog'
import { RowAction, RowMenu } from '../../components/row-actions'
import { useMobile } from '../../core/scaffold/use-mobile'
import { Button, Dialog, Spinner } from '../../core/ui/primitives'
import { displayName } from '../../auth/auth-context'
import { errorMessage } from '../../lib/api/errors'
import { usePagedList } from '../../lib/api/pagination'
import { useRouteScope } from '../../routing/route-context'
import { PersonAvatar } from '../members/members-page'
import { useMemberOptions } from '../members/queries'
import { OrganizationSettingsLayout } from '../organizations/settings-layout'
import { useFormat, useMessages } from '../../i18n/provider'
import {
    useAddGroupMembers,
    useCreateGroup,
    useDeleteGroup,
    useGroupMembers,
    useGroups,
    useRemoveGroupMember,
    useRenameGroup,
} from './queries'

type Open =
    | { kind: 'new' }
    | { kind: 'rename'; group: Group }
    | { kind: 'delete'; group: Group }
    | { kind: 'members'; group: Group }

export function GroupsPage() {
    const { org } = useRouteScope()
    const mobile = useMobile()
    const t = useMessages()
    const format = useFormat()
    const text = t.organizations.groups
    const list = useGroups(org.id)
    const { rows, pagination } = usePagedList(list)
    const [open, setOpen] = useState<Open | null>(null)
    const create = useCreateGroup(org.id)
    const rename = useRenameGroup(org.id)
    const remove = useDeleteGroup(org.id)
    const close = () => {
        create.reset()
        rename.reset()
        setOpen(null)
    }
    const name: DataColumn<Group> = {
        key: 'name',
        header: t.common.name,
        width: mobile ? 200 : 280,
        pinned: 'left',
        hideable: false,
        cell: (row) => <span className="truncate">{row.name}</span>,
    }
    const members: DataColumn<Group> = {
        key: 'members',
        header: text.members,
        width: 110,
        align: 'right',
        hideable: false,
        cell: (row) => format.number(row.member_count),
    }
    const actions: DataColumn<Group> = {
        key: 'actions',
        header: '',
        width: 48,
        minWidth: 48,
        pinned: 'right',
        hideable: false,
        resizable: false,
        cell: (row) => (
            <RowMenu
                label={t.common.actionsFor(row.name)}
                items={[
                    {
                        key: 'members',
                        label: text.members,
                        icon: 'users',
                        onSelect: () => setOpen({ kind: 'members', group: row }),
                    },
                    {
                        key: 'rename',
                        label: t.common.rename,
                        icon: 'edit',
                        onSelect: () => setOpen({ kind: 'rename', group: row }),
                    },
                    {
                        key: 'delete',
                        label: t.common.delete,
                        icon: 'trash',
                        destructive: true,
                        onSelect: () => setOpen({ kind: 'delete', group: row }),
                    },
                ]}
            />
        ),
    }
    const columns: DataColumn<Group>[] = mobile
        ? [name, members, actions]
        : [
              name,
              members,
              {
                  key: 'created',
                  header: t.common.created,
                  width: 140,
                  cell: (row) => format.date(row.created_at),
              },
              actions,
          ]
    const table = useDataTable<Group>({ columns, getRowId: (row) => row.id, selectable: false })
    return (
        <OrganizationSettingsLayout
            section="groups"
            fill
            actions={[
                {
                    id: 'new',
                    label: text.new,
                    icon: 'plus',
                    onSelect: () => setOpen({ kind: 'new' }),
                },
            ]}
        >
            <DataTable<Group>
                table={table}
                rows={rows}
                label={text.label}
                text={text.table}
                getRowLabel={(row) => row.name}
                onRowActivate={(row) => setOpen({ kind: 'members', group: row })}
                loading={list.isPending}
                error={list.isError && !list.data ? list.error : undefined}
                onRetry={() => void list.refetch()}
                pagination={pagination}
                emptyState={<p>{text.empty}</p>}
            />
            {open?.kind === 'new' && (
                <NameDialog
                    title={text.new}
                    submitLabel={t.common.create}
                    pending={create.isPending}
                    error={create.error}
                    onClose={close}
                    onSubmit={(value) =>
                        create.mutate(
                            { path: { org_id: org.id }, body: { name: value } },
                            { onSuccess: close },
                        )
                    }
                />
            )}
            {open?.kind === 'rename' && (
                <NameDialog
                    title={t.common.rename}
                    initialName={open.group.name}
                    submitLabel={t.common.save}
                    pending={rename.isPending}
                    error={rename.error}
                    onClose={close}
                    onSubmit={(value) =>
                        rename.mutate(
                            {
                                path: { org_id: org.id, group_id: open.group.id },
                                body: { name: value },
                            },
                            { onSuccess: close },
                        )
                    }
                />
            )}
            {open?.kind === 'delete' && (
                <ConfirmDialog
                    title={text.deleteTitle(open.group.name)}
                    onClose={close}
                    onConfirm={() =>
                        remove.mutateAsync({ path: { org_id: org.id, group_id: open.group.id } })
                    }
                />
            )}
            {open?.kind === 'members' && (
                <GroupMembersDialog orgId={org.id} group={open.group} onClose={close} />
            )}
        </OrganizationSettingsLayout>
    )
}

function GroupMembersDialog({
    orgId,
    group,
    onClose,
}: {
    orgId: string
    group: Group
    onClose: () => void
}) {
    const t = useMessages()
    const format = useFormat()
    const text = t.organizations.groups
    const { notify } = usePresentation()
    const list = useGroupMembers(orgId, group.id)
    const { rows, pagination } = usePagedList(list)
    const options = useMemberOptions(orgId)
    const [picked, setPicked] = useState<Member[]>([])
    const add = useAddGroupMembers(orgId, group.id)
    const remove = useRemoveGroupMember(orgId, group.id)
    const columns: DataColumn<Member>[] = [
        {
            key: 'person',
            header: text.person,
            width: 260,
            hideable: false,
            resizable: false,
            cell: (row) => (
                <span className="flex min-w-0 items-center gap-2">
                    <PersonAvatar person={row} />
                    <span className="truncate">{displayName(row)}</span>
                    {row.name.trim() && (
                        <span className="truncate text-muted-foreground">{row.email}</span>
                    )}
                </span>
            ),
        },
        {
            key: 'actions',
            header: '',
            width: 48,
            minWidth: 48,
            pinned: 'right',
            hideable: false,
            resizable: false,
            cell: (row) => (
                <RowAction
                    label={text.removeMember(displayName(row))}
                    icon="close"
                    destructive
                    disabled={
                        remove.isPending &&
                        remove.variables.path.user_id === row.user_id &&
                        text.removing
                    }
                    onSelect={() =>
                        remove.mutate(
                            { path: { org_id: orgId, group_id: group.id, user_id: row.user_id } },
                            { onError: (error) => notify(errorMessage(error, t), 'error') },
                        )
                    }
                />
            ),
        },
    ]
    const table = useDataTable<Member>({
        columns,
        getRowId: (row) => row.user_id,
        selectable: false,
    })
    return (
        <Dialog open title={text.membersOf(group.name)} onClose={onClose}>
            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <MultiCombobox<Member>
                        {...options}
                        label={text.addPeople}
                        placeholder={
                            picked.length
                                ? text.picked(picked.length, format.number(picked.length))
                                : text.addPeople
                        }
                        value={picked}
                        onValueChange={setPicked}
                        getItemId={(member) => member.user_id}
                        getItemLabel={(member) => displayName(member)}
                        renderItem={(member) => (
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate">{displayName(member)}</span>
                                {member.name.trim() && (
                                    <span className="truncate text-muted-foreground">
                                        {member.email}
                                    </span>
                                )}
                            </span>
                        )}
                        className="min-w-0 flex-1"
                        disabled={add.isPending}
                    />
                    <Button
                        variant="default"
                        disabled={!picked.length || add.isPending}
                        onClick={() =>
                            add.mutate(
                                {
                                    path: { org_id: orgId, group_id: group.id },
                                    body: { user_ids: picked.map((member) => member.user_id) },
                                },
                                {
                                    onSuccess: () => setPicked([]),
                                    onError: (error) => notify(errorMessage(error, t), 'error'),
                                },
                            )
                        }
                    >
                        {add.isPending && <Spinner label={text.adding} />}
                        {t.common.add}
                    </Button>
                </div>
                <div className="flex h-80 min-h-0 flex-col">
                    <DataTable<Member>
                        flat
                        table={table}
                        rows={rows}
                        label={text.membersOf(group.name)}
                        text={t.organizations.members.table}
                        getRowLabel={(row) => row.email}
                        loading={list.isPending}
                        error={list.isError && !list.data ? list.error : undefined}
                        onRetry={() => void list.refetch()}
                        pagination={pagination}
                        emptyState={<p>{text.noMembers}</p>}
                    />
                </div>
            </div>
        </Dialog>
    )
}
