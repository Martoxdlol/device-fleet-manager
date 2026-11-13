import { useState } from 'react'
import { oneOf, useStoredState } from '../../core/storage/use-stored-state'
import { columnWidth, nextSort } from './model'
import type { DataTableController, DataTableOptions, TableSort, TableView, TileSize } from './types'

interface ViewPrefs {
    view: TableView
    tileSize: TileSize
    widths: Record<string, number>
    visibility: Record<string, boolean>
}

const parseView = oneOf(['list', 'grid'] as const)
const parseTileSize = oneOf(['sm', 'md', 'lg'] as const)

function record<V>(raw: unknown, valid: (value: unknown) => value is V) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
    return Object.fromEntries(Object.entries(raw).filter(([, value]) => valid(value))) as Record<
        string,
        V
    >
}

export function useDataTable<T>(options: DataTableOptions<T>): DataTableController<T> {
    const initial: ViewPrefs = {
        view: options.initialView ?? 'list',
        tileSize: options.initialTileSize ?? 'md',
        widths: {},
        visibility: {},
    }
    const [internalSelection, setInternalSelection] = useState<ReadonlySet<string>>(() => new Set())
    const [internalSort, setInternalSort] = useState<TableSort>(null)
    const [prefs, setPrefs] = useStoredState<ViewPrefs>(
        options.storageKey && `table.${options.storageKey}`,
        initial,
        (raw) => {
            if (typeof raw !== 'object' || raw === null) return undefined
            const value = raw as Partial<Record<keyof ViewPrefs, unknown>>
            return {
                view: parseView(value.view) ?? initial.view,
                tileSize: parseTileSize(value.tileSize) ?? initial.tileSize,
                widths: record(
                    value.widths,
                    (v): v is number => typeof v === 'number' && Number.isFinite(v),
                ),
                visibility: record(value.visibility, (v): v is boolean => typeof v === 'boolean'),
            }
        },
    )
    const selection = options.selection ?? internalSelection
    const sort = options.sort === undefined ? internalSort : options.sort
    const visibleColumns = options.columns.filter(
        (column) =>
            column.hideable === false ||
            (prefs.visibility[column.key] ?? column.defaultVisible ?? true),
    )
    const setSelection = (next: ReadonlySet<string>) => {
        if (options.selection === undefined) setInternalSelection(next)
        options.onSelectionChange?.(next)
    }
    const applySort = (next: TableSort) => {
        if (options.sort === undefined) setInternalSort(next)
        options.onSortChange?.(next)
    }
    const sortable = (key: string) =>
        options.columns.some((column) => column.key === key && column.sortable)
    return {
        columns: options.columns,
        getRowId: options.getRowId,
        selectable: options.selectable ?? true,
        selection,
        setSelection,
        clearSelection: () => setSelection(new Set()),
        sort,
        toggleSort: (key) => {
            if (sortable(key)) applySort(nextSort(sort, key))
        },
        setSort: (key, direction) => {
            if (sortable(key)) applySort({ key, direction })
        },
        view: prefs.view,
        setView: (view) => setPrefs((old) => ({ ...old, view })),
        tileSize: prefs.tileSize,
        setTileSize: (tileSize) => setPrefs((old) => ({ ...old, tileSize })),
        columnWidths: prefs.widths,
        setColumnWidth: (key, width) => {
            const column = options.columns.find((column) => column.key === key)
            if (column && Number.isFinite(width))
                setPrefs((old) => ({
                    ...old,
                    widths: { ...old.widths, [key]: columnWidth(column, width) },
                }))
        },
        visibleColumns,
        toggleColumn: (key) => {
            const column = options.columns.find((column) => column.key === key)
            if (
                !column ||
                column.hideable === false ||
                (visibleColumns.length === 1 && visibleColumns[0].key === key)
            )
                return
            setPrefs((old) => ({
                ...old,
                visibility: {
                    ...old.visibility,
                    [key]: !(old.visibility[key] ?? column.defaultVisible ?? true),
                },
            }))
        },
        resetView: () => setPrefs(initial),
    }
}
