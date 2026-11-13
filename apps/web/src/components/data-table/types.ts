import type { CSSProperties, ReactNode } from 'react'
import type { KeyBinding } from '../../core/keyboard/keyboard-context'
import type { DragStart, DropSpec } from '../drag/drag-model'
import type { TableText } from '../list-text'

export type TableView = 'list' | 'grid'
export type TileSize = 'sm' | 'md' | 'lg'
export type TableSort = { key: string; direction: 'asc' | 'desc' } | null

export interface DataTableActionContext<T> {
    selectedIds: ReadonlySet<string>
    selectionCount: number
    selectedRows: readonly T[]
    allSelectedRowsLoaded: boolean
    via: 'toolbar' | 'menu' | 'keys'
}

export interface DataTableActionDef<T> {
    key: string
    label: string
    icon: ReactNode
    visible?: boolean | ((context: DataTableActionContext<T>) => boolean)
    disabled?: boolean | string | ((context: DataTableActionContext<T>) => boolean | string)
    onClick: (context: DataTableActionContext<T>) => void
    tooltip?: string
    showLabel?: boolean
    variant?: 'default' | 'destructive'
    keys?: KeyBinding
    nativeKeys?: boolean
    group?: string
    placement?: 'toolbar' | 'menu' | 'both'
}

export interface DataTableFilterGroup {
    key: string
    label: string
    value: string
    defaultValue: string
    onValueChange: (value: string) => void
    options: readonly { value: string; label: string }[]
}

export interface DataColumn<T> {
    key: string
    header: string
    icon?: ReactNode
    cell: (row: T) => ReactNode
    width?: number
    minWidth?: number
    maxWidth?: number
    align?: 'left' | 'right'
    pinned?: 'left' | 'right'
    hideable?: boolean
    defaultVisible?: boolean
    resizable?: boolean
    sortable?: boolean
    onSort?: () => void
    sorted?: 'asc' | 'desc'
    headerPopover?: (close: () => void) => ReactNode
    headerTooltip?: string
}

export interface DataTableOptions<T> {
    columns: readonly DataColumn<T>[]
    getRowId: (row: T) => string
    selection?: ReadonlySet<string>
    onSelectionChange?: (selection: ReadonlySet<string>) => void
    sort?: TableSort
    onSortChange?: (sort: TableSort) => void
    selectable?: boolean | ((row: T) => boolean)
    initialView?: TableView
    initialTileSize?: TileSize
    storageKey?: string
}

export interface ColumnLayout<T> {
    column: DataColumn<T>
    width: number
    style: CSSProperties
}

export type RowDrop<T> = (row: T) => DropSpec | undefined

export interface CursorPagination {
    nextCursor: string | null
    fetchNextPage: () => Promise<unknown>
    isFetchingNextPage: boolean
    error?: unknown
}

export interface DataTableProps<T> {
    table: DataTableController<T>
    rows: readonly T[]
    label: string
    getRowLabel?: (row: T) => string
    onRowActivate?: (row: T) => void
    tile?: (row: T, size: TileSize) => ReactNode
    toolbar?: ReactNode
    footer?: ReactNode
    emptyState?: ReactNode
    loading?: boolean
    error?: unknown
    onRetry?: () => void
    pagination?: CursorPagination
    resetKey?: string
    totalCount?: number
    text?: TableText
    rowDrag?: (rows: readonly T[]) => DragStart | null
    rowDrop?: RowDrop<T>
    rowGroup?: (row: T) => string
    actions?: readonly DataTableActionDef<T>[]
    menuTitle?: (rows: readonly T[]) => string
    dimmed?: (row: T) => boolean
    onPaste?: (event: ClipboardEvent) => void
    accent?: boolean
    flat?: boolean
    className?: string
}

export interface DataTableController<T> {
    columns: readonly DataColumn<T>[]
    getRowId: (row: T) => string
    selectable: DataTableOptions<T>['selectable']
    selection: ReadonlySet<string>
    setSelection: (next: ReadonlySet<string>) => void
    clearSelection: () => void
    sort: TableSort
    toggleSort: (key: string) => void
    setSort: (key: string, direction: 'asc' | 'desc') => void
    view: TableView
    setView: (view: TableView) => void
    tileSize: TileSize
    setTileSize: (size: TileSize) => void
    columnWidths: Readonly<Record<string, number>>
    setColumnWidth: (key: string, width: number) => void
    visibleColumns: readonly DataColumn<T>[]
    toggleColumn: (key: string) => void
    resetView: () => void
}
