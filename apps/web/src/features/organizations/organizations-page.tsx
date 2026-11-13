import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { MyOrganization } from '@fleet/client'
import { useAuth } from '../../auth/auth-context'
import { useAppNavigate } from '../../auth/navigation'
import { useCanCreateOrganization } from '../../auth/instance'
import { DataTable, useDataTable, type DataColumn } from '../../components/data-table'
import { OrgAvatar } from '../../components/layout/org-avatar'
import { PageLayout } from '../../components/layout/page-layout'
import { PageContent } from '../../core/scaffold/scaffold'
import { Icon } from '../../core/ui/icon'
import { usePagedList } from '../../lib/api/pagination'
import { organizationPath } from '../../routing/paths'
import { rememberRoute } from '../../routing/resolution'
import { useMessages } from '../../i18n/provider'
import { NewOrganizationDialog } from './new-organization-dialog'
import { useOrganizations } from './queries'

export function OrganizationsPage({ listed }: { listed: boolean }) {
    const { api } = useAuth()
    const cache = useQueryClient()
    const navigate = useAppNavigate()
    const canCreate = useCanCreateOrganization()
    const t = useMessages()
    const text = t.organizations.list
    const list = useOrganizations()
    const { rows, pagination } = usePagedList(list)
    const [creating, setCreating] = useState(false)
    useEffect(() => {
        if (!listed) navigate('/', { replace: true, state: { list: true } })
    })
    const columns: DataColumn<MyOrganization>[] = [
        {
            key: 'name',
            header: t.common.name,
            width: 320,
            pinned: 'left',
            hideable: false,
            cell: (row) => (
                <span className="flex min-w-0 items-center gap-2.5">
                    <OrgAvatar organization={row} className="size-6 text-[9px]" />
                    <span className="truncate">{row.name}</span>
                </span>
            ),
        },
        {
            key: 'role',
            header: text.role,
            width: 140,
            cell: (row) => t.organizations.roles[row.role],
        },
    ]
    const table = useDataTable<MyOrganization>({
        columns,
        getRowId: (row) => row.id,
        selectable: false,
    })
    return (
        <PageLayout
            title={text.title}
            actions={
                canCreate
                    ? [
                          {
                              id: 'new',
                              label: t.organizations.menu.new,
                              icon: 'plus',
                              onSelect: () => setCreating(true),
                          },
                      ]
                    : []
            }
        >
            <PageContent mode="fill" width="directory">
                <DataTable<MyOrganization>
                    table={table}
                    rows={rows}
                    label={text.title}
                    text={text.table}
                    getRowLabel={(row) => row.name}
                    onRowActivate={(org) => {
                        rememberRoute(api, cache, org)
                        navigate(organizationPath(org))
                    }}
                    loading={list.isPending}
                    error={list.isError && !list.data ? list.error : undefined}
                    onRetry={() => void list.refetch()}
                    pagination={pagination}
                    emptyState={
                        <>
                            <Icon name="building" />
                            <p>{text.empty}</p>
                        </>
                    }
                />
            </PageContent>
            {creating && <NewOrganizationDialog onClose={() => setCreating(false)} />}
        </PageLayout>
    )
}
