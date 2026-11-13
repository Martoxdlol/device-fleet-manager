import { useState } from 'react'
import type { AccessLevel, Grant } from '@fleet/client'
import { Combobox } from '../../components/combobox'
import { ConfirmDialog } from '../../components/confirm-dialog'
import { DataTable, useDataTable, type DataColumn } from '../../components/data-table'
import { usePresentation } from '../../components/feedback/presentation-context'
import { RowAction } from '../../components/row-actions'
import { Icon } from '../../core/ui/icon'
import { Button, Dialog, Field, Spinner } from '../../core/ui/primitives'
import { useMobile } from '../../core/scaffold/use-mobile'
import { errorMessage } from '../../lib/api/errors'
import { usePagedList } from '../../lib/api/pagination'
import { useFleetScope } from '../../routing/route-context'
import { useFormat, useMessages } from '../../i18n/provider'
import {
    useCreateGrant,
    useDeleteGrant,
    useGrants,
    useSubjectOptions,
    useUpdateGrant,
    type Subject,
} from './queries'
import { FleetSettingsLayout } from './settings-layout'

const levels: AccessLevel[] = ['read', 'write', 'admin']

export function FleetAccessPage() {
    const { fleet } = useFleetScope()
    return <FleetAccess key={fleet.id} />
}

function FleetAccess() {
    const { org, fleet } = useFleetScope()
    const mobile = useMobile()
    const { notify } = usePresentation()
    const t = useMessages()
    const format = useFormat()
    const text = t.fleets.grants
    const list = useGrants(fleet.id)
    const { rows, pagination } = usePagedList(list)
    const update = useUpdateGrant(fleet.id)
    const remove = useDeleteGrant(fleet.id)
    const [adding, setAdding] = useState(false)
    const [removing, setRemoving] = useState<Grant | null>(null)
    const shownLevel = (row: Grant): AccessLevel =>
        update.isPending && update.variables.path.grant_id === row.id
            ? update.variables.body.level
            : row.level
    const subject: DataColumn<Grant> = {
        key: 'subject',
        header: text.subject,
        width: mobile ? 200 : 260,
        pinned: 'left',
        hideable: false,
        cell: (row) => (
            <span className="flex min-w-0 items-center gap-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
                <Icon name={row.group_id ? 'users' : 'user'} />
                <span className="truncate">{row.subject_name || row.subject_email}</span>
                {row.subject_email && row.subject_name && !mobile && (
                    <span className="truncate text-muted-foreground">{row.subject_email}</span>
                )}
            </span>
        ),
    }
    const level: DataColumn<Grant> = {
        key: 'level',
        header: text.level,
        width: 140,
        hideable: false,
        cell: (row) => (
            <Combobox
                label={text.levelOf(row.subject_name || row.subject_email || '')}
                searchable={false}
                items={levels}
                value={shownLevel(row)}
                onValueChange={(next) => {
                    if (!next || next === row.level) return
                    update.mutate(
                        { path: { fleet_id: fleet.id, grant_id: row.id }, body: { level: next } },
                        { onError: (error) => notify(errorMessage(error, t), 'error') },
                    )
                }}
                getItemId={(item) => item}
                getItemLabel={(item) => t.fleets.access[item]}
                className="-mx-2.5 w-full"
                triggerClassName="border-transparent dark:bg-transparent hover:bg-muted"
                disabled={update.isPending}
            />
        ),
    }
    const actions: DataColumn<Grant> = {
        key: 'actions',
        header: '',
        width: 48,
        minWidth: 48,
        pinned: 'right',
        hideable: false,
        resizable: false,
        cell: (row) => (
            <RowAction
                label={text.remove}
                icon="trash"
                destructive
                onSelect={() => setRemoving(row)}
            />
        ),
    }
    const columns: DataColumn<Grant>[] = mobile
        ? [subject, level, actions]
        : [
              subject,
              {
                  key: 'kind',
                  header: text.kind,
                  width: 110,
                  cell: (row) => (row.group_id ? text.group : text.person),
              },
              level,
              {
                  key: 'created',
                  header: t.common.created,
                  width: 140,
                  cell: (row) => format.date(row.created_at),
              },
              actions,
          ]
    const table = useDataTable<Grant>({ columns, getRowId: (row) => row.id, selectable: false })
    return (
        <FleetSettingsLayout
            section="access"
            fill
            actions={[
                { id: 'add', label: text.add, icon: 'plus', onSelect: () => setAdding(true) },
            ]}
        >
            <DataTable<Grant>
                table={table}
                rows={rows}
                label={text.label}
                text={text.table}
                getRowLabel={(row) => row.subject_name || row.subject_email || row.id}
                loading={list.isPending}
                error={list.isError && !list.data ? list.error : undefined}
                onRetry={() => void list.refetch()}
                pagination={pagination}
                emptyState={<p>{text.empty(org.name)}</p>}
            />
            {adding && <GrantDialog onClose={() => setAdding(false)} />}
            {removing && (
                <ConfirmDialog
                    title={text.removeTitle(removing.subject_name || removing.subject_email || '')}
                    label={t.common.remove}
                    onClose={() => setRemoving(null)}
                    onConfirm={() =>
                        remove.mutateAsync({ path: { fleet_id: fleet.id, grant_id: removing.id } })
                    }
                />
            )}
        </FleetSettingsLayout>
    )
}

function GrantDialog({ onClose }: { onClose: () => void }) {
    const { org, fleet } = useFleetScope()
    const t = useMessages()
    const text = t.fleets.grants
    const options = useSubjectOptions(org.id)
    const [subject, setSubject] = useState<Subject | null>(null)
    const [level, setLevel] = useState<AccessLevel>('read')
    const create = useCreateGrant(fleet.id)
    return (
        <Dialog
            open
            title={text.add}
            onClose={() => {
                if (!create.isPending) onClose()
            }}
        >
            <form
                className="flex flex-col gap-4.5"
                aria-busy={create.isPending}
                onSubmit={(event) => {
                    event.preventDefault()
                    if (!subject || create.isPending) return
                    create.mutate(
                        {
                            path: { fleet_id: fleet.id },
                            body:
                                subject.kind === 'user'
                                    ? { user_id: subject.id, level }
                                    : { group_id: subject.id, level },
                        },
                        { onSuccess: onClose },
                    )
                }}
            >
                <Field label={text.subject}>
                    <Combobox<Subject>
                        {...options}
                        label={text.subject}
                        placeholder={text.choose}
                        value={subject}
                        onValueChange={setSubject}
                        getItemId={(item) => `${item.kind}:${item.id}`}
                        getItemLabel={(item) =>
                            item.kind === 'user' ? item.name.trim() || item.email : item.name
                        }
                        getItemGroup={(item) => (item.kind === 'user' ? text.people : text.groups)}
                        renderItem={(item) => (
                            <span className="flex min-w-0 items-center gap-2">
                                <Icon name={item.kind === 'user' ? 'user' : 'users'} />
                                <span className="truncate">
                                    {item.kind === 'user'
                                        ? item.name.trim() || item.email
                                        : item.name}
                                </span>
                                {item.kind === 'user' && item.name.trim() && (
                                    <span className="truncate text-muted-foreground">
                                        {item.email}
                                    </span>
                                )}
                            </span>
                        )}
                        disabled={create.isPending}
                    />
                </Field>
                <Field label={text.level}>
                    <Combobox
                        label={text.level}
                        searchable={false}
                        items={levels}
                        value={level}
                        onValueChange={(next) => {
                            if (next) setLevel(next)
                        }}
                        getItemId={(item) => item}
                        getItemLabel={(item) => t.fleets.access[item]}
                        disabled={create.isPending}
                    />
                </Field>
                {create.error != null && (
                    <p role="alert" className="text-xs text-destructive">
                        {errorMessage(create.error, t)}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} disabled={create.isPending}>
                        {t.common.cancel}
                    </Button>
                    <Button type="submit" variant="default" disabled={!subject || create.isPending}>
                        {create.isPending && <Spinner label={text.adding} />}
                        {t.common.add}
                    </Button>
                </div>
            </form>
        </Dialog>
    )
}
