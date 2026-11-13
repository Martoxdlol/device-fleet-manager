import { useState } from 'react'
import type { AgentKey } from '@fleet/client'
import { ConfirmDialog } from '../../components/confirm-dialog'
import { DataTable, useDataTable, type DataColumn } from '../../components/data-table'
import { NameDialog } from '../../components/forms/name-dialog'
import { RowMenu } from '../../components/row-actions'
import { usePagedList } from '../../lib/api/pagination'
import { useRouteScope } from '../../routing/route-context'
import { OrganizationSettingsLayout } from '../organizations/settings-layout'
import { useFormat, useMessages } from '../../i18n/provider'
import { PublicKey } from './public-key'
import { useAgentKeys, useCreateKey, useDeleteKey, useRenameKey } from './queries'

type Open = { kind: 'new' } | { kind: 'rename'; key: AgentKey } | { kind: 'delete'; key: AgentKey }

export function AgentKeysPage() {
    const { org } = useRouteScope()
    const t = useMessages()
    const format = useFormat()
    const text = t.organizations.keys
    const list = useAgentKeys(org.id)
    const { rows, pagination } = usePagedList(list)
    const [open, setOpen] = useState<Open | null>(null)
    const create = useCreateKey(org.id)
    const rename = useRenameKey(org.id)
    const remove = useDeleteKey(org.id)
    const close = () => {
        create.reset()
        rename.reset()
        setOpen(null)
    }
    const name: DataColumn<AgentKey> = {
        key: 'name',
        header: t.common.name,
        width: 200,
        pinned: 'left',
        hideable: false,
        cell: (row) => <span className="truncate">{row.name}</span>,
    }
    const fleets: DataColumn<AgentKey> = {
        key: 'fleets',
        header: text.fleets,
        width: 90,
        align: 'right',
        hideable: false,
        cell: (row) => format.number(row.fleet_count),
    }
    const actions: DataColumn<AgentKey> = {
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
                        key: 'rename',
                        label: t.common.rename,
                        icon: 'edit',
                        onSelect: () => setOpen({ kind: 'rename', key: row }),
                    },
                    {
                        key: 'delete',
                        label: t.common.delete,
                        icon: 'trash',
                        destructive: true,
                        disabled: row.fleet_count > 0 && text.inUse,
                        onSelect: () => setOpen({ kind: 'delete', key: row }),
                    },
                ]}
            />
        ),
    }
    const columns: DataColumn<AgentKey>[] = [
        name,
        {
            key: 'publicKey',
            header: text.publicKey,
            width: 320,
            cell: (row) => <PublicKey value={row.public_key} label={text.publicKeyOf(row.name)} />,
        },
        fleets,
        {
            key: 'created',
            header: t.common.created,
            width: 140,
            cell: (row) => format.date(row.created_at),
        },
        actions,
    ]
    const table = useDataTable<AgentKey>({ columns, getRowId: (row) => row.id, selectable: false })
    return (
        <OrganizationSettingsLayout
            section="keys"
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
            <DataTable<AgentKey>
                table={table}
                rows={rows}
                label={text.label}
                text={text.table}
                getRowLabel={(row) => row.name}
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
                    initialName={open.key.name}
                    submitLabel={t.common.save}
                    pending={rename.isPending}
                    error={rename.error}
                    onClose={close}
                    onSubmit={(value) =>
                        rename.mutate(
                            {
                                path: { org_id: org.id, key_id: open.key.id },
                                body: { name: value },
                            },
                            { onSuccess: close },
                        )
                    }
                />
            )}
            {open?.kind === 'delete' && (
                <ConfirmDialog
                    title={text.deleteTitle(open.key.name)}
                    onClose={close}
                    onConfirm={() =>
                        remove.mutateAsync({ path: { org_id: org.id, key_id: open.key.id } })
                    }
                />
            )}
        </OrganizationSettingsLayout>
    )
}
