import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { MyOrganization, VisibleFleet } from '@fleet/client'
import { useAuth } from '../../auth/auth-context'
import { useAppNavigate } from '../../auth/navigation'
import { DataTable, useDataTable, type DataColumn } from '../../components/data-table'
import { NamedResourceDialog } from '../../components/forms/named-resource-dialog'
import { PageLayout } from '../../components/layout/page-layout'
import { PageContent } from '../../core/scaffold/scaffold'
import { Icon } from '../../core/ui/icon'
import { usePagedList } from '../../lib/api/pagination'
import { fleetPath, organizationPath } from '../../routing/paths'
import { rememberRoute } from '../../routing/resolution'
import { useRouteScope } from '../../routing/route-context'
import { isOrgAdmin } from '../members/roles'
import { useFormat, useMessages } from '../../i18n/provider'
import { useCreateFleet, useFleets } from './queries'

export function FleetsPage() {
    const { org } = useRouteScope()
    return <FleetDirectory key={org.id} org={org} />
}

function FleetDirectory({ org }: { org: MyOrganization }) {
    const { api } = useAuth()
    const cache = useQueryClient()
    const navigate = useAppNavigate()
    const t = useMessages()
    const format = useFormat()
    const text = t.fleets.list
    const list = useFleets(org.id)
    const { rows, pagination } = usePagedList(list)
    const [creating, setCreating] = useState(false)
    const create = useCreateFleet(org)
    const columns: DataColumn<VisibleFleet>[] = [
        {
            key: 'name',
            header: t.common.name,
            width: 280,
            pinned: 'left',
            hideable: false,
            cell: (row) => (
                <span className="flex min-w-0 items-center gap-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
                    <Icon name="layers" />
                    <span className="truncate">{row.name}</span>
                </span>
            ),
        },
        {
            key: 'access',
            header: text.access,
            width: 120,
            cell: (row) => t.fleets.access[row.access],
        },
        {
            key: 'created',
            header: t.common.created,
            width: 140,
            cell: (row) => format.date(row.created_at),
        },
    ]
    const table = useDataTable<VisibleFleet>({
        columns,
        getRowId: (row) => row.id,
        selectable: false,
    })
    return (
        <PageLayout
            title={org.name}
            actions={
                isOrgAdmin(org.role)
                    ? [
                          {
                              id: 'new',
                              label: text.new,
                              icon: 'plus',
                              onSelect: () => setCreating(true),
                          },
                      ]
                    : []
            }
        >
            <PageContent mode="fill">
                <DataTable<VisibleFleet>
                    table={table}
                    rows={rows}
                    label={text.label}
                    text={text.table}
                    getRowLabel={(row) => row.name}
                    onRowActivate={(fleet) => {
                        rememberRoute(api, cache, org, fleet)
                        navigate(fleetPath(org, fleet))
                    }}
                    loading={list.isPending}
                    error={list.isError && !list.data ? list.error : undefined}
                    onRetry={() => void list.refetch()}
                    pagination={pagination}
                    emptyState={
                        <>
                            <Icon name="layers" />
                            <p>{isOrgAdmin(org.role) ? text.empty : text.emptyMember}</p>
                        </>
                    }
                />
            </PageContent>
            {creating && (
                <NamedResourceDialog
                    title={text.new}
                    urlPrefix={`${organizationPath(org)}/`}
                    pending={create.isPending}
                    error={create.error}
                    onClose={() => {
                        create.reset()
                        setCreating(false)
                    }}
                    onSubmit={(body) =>
                        create.mutate(
                            { path: { org_id: org.id }, body },
                            { onSuccess: (fleet) => navigate(fleetPath(org, fleet)) },
                        )
                    }
                />
            )}
        </PageLayout>
    )
}
