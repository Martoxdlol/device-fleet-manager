import type { CSSProperties, ReactNode } from 'react'
import type { KeyBinding } from '../../core/keyboard/keyboard-context'
import type { DragStart, DropSpec } from '../drag/drag-model'
import type { TableText } from '../list-text'

export type TableView = 'list' | 'grid'
export type TileSize = 'sm' | 'md' | 'lg'
export type TableSort = { key: string; direction: 'asc' | 'desc' } | null

/**
 * What an action acts on: the selection, or in a menu the right-clicked row alone when it is
 * outside the selection, and nothing in the empty space below the rows.
 */
export interface DataTableActionContext<T> {
    selectedIds: ReadonlySet<string>
    /** Counts IDs, including selections outside the supplied rows. */
    selectionCount: number
    selectedRows: readonly T[]
    allSelectedRowsLoaded: boolean
    /** Where it runs from: the toolbar, a row's or the empty space's menu, or its keys. */
    via: 'toolbar' | 'menu' | 'keys'
}

export interface DataTableActionDef<T> {
    key: string
    label: string
    icon: ReactNode
    /** Defaults to visible, including when nothing is selected. */
    visible?: boolean | ((context: DataTableActionContext<T>) => boolean)
    /** A string disables the action and explains why in its tooltip. */
    disabled?: boolean | string | ((context: DataTableActionContext<T>) => boolean | string)
    onClick: (context: DataTableActionContext<T>) => void
    tooltip?: string
    /** Actions render as icons; opt in to show the label above 600px of table width. */
    showLabel?: boolean
    variant?: 'default' | 'destructive'
    /** Runs it while focus is in the list and not in a field; menus show it on the right. */
    keys?: KeyBinding
    /** The browser's own event runs it, such as a paste: menus show `keys`, the list binds none. */
    nativeKeys?: boolean
    /** Menus separate groups, in the order they first appear. */
    group?: string
    /** Where it shows. Both by default. */
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
    /** Emits sort state; the consumer sorts locally or forwards it to its query. */
    sortable?: boolean
    /** Sorts by the consumer's own rules instead: the header calls this and shows `sorted`. */
    onSort?: () => void
    sorted?: 'asc' | 'desc'
    /** Opens from the header of a column that does not sort; `close` dismisses it. */
    headerPopover?: (close: () => void) => ReactNode
    /** Says on hover why a header without a sort or popover does nothing. */
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
    /** Remember view, tile size, column widths and visibility per browser. */
    storageKey?: string
}

export interface ColumnLayout<T> {
    column: DataColumn<T>
    width: number
    style: CSSProperties
}

/** Rows as drop targets, for whatever the channel carries. */
/** What a row takes. A row without a spec refuses every drag, so the drag falls to the plane. */
export type RowDrop<T> = (row: T) => DropSpec | undefined

/** Pass the next opaque cursor, not the number of loaded rows. */
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
    /**
     * Opening a row: a plain click or Enter. A checkbox, a modified click and an arrow key only
     * change the selection, so opening stays distinct from picking rows for a bulk action.
     */
    onRowActivate?: (row: T) => void
    /** Tile content for grid view. Without it the table stays a list. */
    tile?: (row: T, size: TileSize) => ReactNode
    toolbar?: ReactNode
    footer?: ReactNode
    emptyState?: ReactNode
    loading?: boolean
    error?: unknown
    onRetry?: () => void
    pagination?: CursorPagination
    /** Change when search, filters, or sort change to reset scroll and range selection. */
    resetKey?: string
    totalCount?: number
    /** What the table says about its rows; generic records when absent. */
    text?: TableText
    /**
     * Makes rows drag sources. It receives what the gesture carries: the whole selection when
     * the row is in it, that row alone otherwise. Returning null refuses the drag.
     */
    rowDrag?: (rows: readonly T[]) => DragStart | null
    rowDrop?: RowDrop<T>
    /**
     * Sections in the list: a heading row opens each run of rows whose group differs from the
     * previous row's. The empty string is the unlabelled first section. List view only.
     */
    rowGroup?: (row: T) => string
    /**
     * The row menu and the empty-space menu, built from the same list as the toolbar, and the
     * keys of its actions.
     */
    actions?: readonly DataTableActionDef<T>[]
    /** What a row menu acting on these rows is titled, as a long press's sheet. */
    menuTitle?: (rows: readonly T[]) => string
    /** Rows shown faded, such as those cut to the clipboard. */
    dimmed?: (row: T) => boolean
    /** The browser's paste while focus is in the list and not in a field. */
    onPaste?: (event: ClipboardEvent) => void
    /** Highlights the whole plane, for a drag hovering over it. */
    accent?: boolean
    /** Sits inside another plane: no border, fill or lift of its own. */
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
