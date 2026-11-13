import { useState } from 'react'
import type { PageUser } from '@fleet/client'
import { displayName, useAccount } from '../../auth/auth-context'
import { LinkDialog } from '../../components/copy-field'
import {
    DataTable,
    DataTableSearch,
    useDataTable,
    type DataColumn,
} from '../../components/data-table'
import { usePresentation } from '../../components/feedback/presentation-context'
import { PageLayout } from '../../components/layout/page-layout'
import { RowAction } from '../../components/row-actions'
import { PageContent } from '../../core/scaffold/scaffold'
import { useMobile } from '../../core/scaffold/use-mobile'
import { Switch } from '../../core/ui/switch'
import { EmptyState } from '../../core/ui/primitives'
import { useDebounced } from '../../hooks/use-debounced'
import { errorMessage } from '../../lib/api/errors'
import { usePagedList } from '../../lib/api/pagination'
import { passwordResetLink } from '../../routing/paths'
import { PersonAvatar } from '../members/members-page'
import { useFormat, useMessages } from '../../i18n/provider'
import { useCreatePasswordReset, useUpdateUser, useUsers } from './queries'

type Row = PageUser['items'][number]

export function AdminPage() {
    const { user } = useAccount()
    const t = useMessages()
    if (!user.instance_admin)
        return (
            <PageLayout title={t.account.admin.title}>
                <PageContent>
                    <EmptyState surface>
                        <h2>{t.account.admin.onlyAdmins}</h2>
                    </EmptyState>
                </PageContent>
            </PageLayout>
        )
    return <UsersPage />
}

function UsersPage() {
    const { user } = useAccount()
    const mobile = useMobile()
    const { notify } = usePresentation()
    const t = useMessages()
    const format = useFormat()
    const text = t.account.admin
    const [search, setSearch] = useState('')
    const term = useDebounced(search.trim())
    const list = useUsers(term)
    const { rows, pagination } = usePagedList(list)
    const update = useUpdateUser()
    const reset = useCreatePasswordReset()
    const [link, setLink] = useState<{ name: string; token: string } | null>(null)
    const shownAdmin = (row: Row) =>
        update.isPending && update.variables.path.user_id === row.id
            ? update.variables.body.instance_admin
            : row.instance_admin
    const name: DataColumn<Row> = {
        key: 'name',
        header: t.common.name,
        width: mobile ? 200 : 240,
        pinned: 'left',
        hideable: false,
        cell: (row) => (
            <span className="flex min-w-0 items-center gap-2">
                <PersonAvatar person={row} />
                <span className="truncate">{mobile ? row.email : displayName(row)}</span>
                {row.id === user.id && (
                    <span className="shrink-0 text-muted-foreground">
                        {t.organizations.members.you}
                    </span>
                )}
            </span>
        ),
    }
    const admin: DataColumn<Row> = {
        key: 'admin',
        header: text.instanceAdmin,
        width: 140,
        hideable: false,
        cell: (row) => (
            <Switch
                aria-label={text.instanceAdminOf(row.email)}
                checked={shownAdmin(row)}
                disabled={update.isPending}
                onCheckedChange={(checked) =>
                    update.mutate(
                        { path: { user_id: row.id }, body: { instance_admin: checked } },
                        { onError: (error) => notify(errorMessage(error, t), 'error') },
                    )
                }
            />
        ),
    }
    const actions: DataColumn<Row> = {
        key: 'actions',
        header: '',
        width: 48,
        minWidth: 48,
        pinned: 'right',
        hideable: false,
        resizable: false,
        cell: (row) => (
            <RowAction
                label={text.resetLink}
                icon="key"
                disabled={reset.isPending && text.creatingLink}
                onSelect={() =>
                    reset.mutate(
                        { path: { user_id: row.id } },
                        {
                            onSuccess: ({ token }) => setLink({ name: displayName(row), token }),
                            onError: (error) => notify(errorMessage(error, t), 'error'),
                        },
                    )
                }
            />
        ),
    }
    const columns: DataColumn<Row>[] = mobile
        ? [name, admin, actions]
        : [
              name,
              {
                  key: 'email',
                  header: t.common.email,
                  width: 260,
                  cell: (row) => <span className="truncate">{row.email}</span>,
              },
              admin,
              {
                  key: 'created',
                  header: t.common.created,
                  width: 140,
                  cell: (row) => format.date(row.created_at),
              },
              actions,
          ]
    const table = useDataTable<Row>({ columns, getRowId: (row) => row.id, selectable: false })
    return (
        <PageLayout
            title={text.title}
            toolbar={
                <DataTableSearch value={search} onChange={setSearch} placeholder={text.search} />
            }
        >
            <PageContent mode="fill">
                <DataTable<Row>
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
            </PageContent>
            {link && (
                <LinkDialog
                    title={text.resetTitle(link.name)}
                    hint={text.resetHint}
                    link={passwordResetLink(link.token)}
                    onClose={() => setLink(null)}
                />
            )}
        </PageLayout>
    )
}
