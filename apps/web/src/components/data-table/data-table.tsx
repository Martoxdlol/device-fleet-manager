import {
    useCallback,
    useContext,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type DragEvent,
    type KeyboardEvent,
    type ReactNode,
} from 'react'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Inbox, Minus, RotateCcw } from 'lucide-react'
import {
    ActionMenuArea,
    isMenuKey,
    openMenuFrom,
    useMenuTarget,
    type MenuItem,
    type MenuRequest,
} from '../action-menu'
import { chipDragImage, DragContext, dropDecision, hintOf, land, useDragScroll } from '../drag'
import { useFocusPaste } from '../use-focus-paste'
import { matchesKey } from '../../core/keyboard/keyboard-context'
import { Popover, PopoverContent, PopoverTrigger } from '../../core/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../core/ui/tooltip'
import { errorMessage } from '../../lib/api/errors'
import { Button, EmptyState } from '../../core/ui/primitives'
import { flatSurfaceClasses, surfaceClasses } from '../../core/ui/surface'
import {
    columnLayout,
    HEADER_HEIGHT,
    ROW_HEIGHT,
    selectRange,
    TILE_GAP,
    TILE_LABEL,
    TILE_WIDTH,
    tilesPerRow,
    toggleLoaded,
} from './model'
import { actionContext, resolveActions } from './action-model'
import type {
    ColumnLayout,
    DataColumn,
    DataTableActionContext,
    DataTableActionDef,
    DataTableController,
    DataTableProps,
} from './types'
import { useFormat, useMessages } from '../../i18n/provider'

const quietCheckbox =
    '[&_.dt-checkbox>span]:opacity-0 group-hover/row:[&_.dt-checkbox>span]:opacity-100 group-focus-visible/row:[&_.dt-checkbox>span]:opacity-100 [&_.dt-checkbox:has(:focus-visible)>span]:opacity-100'
function SelectionCheckbox({
    checked,
    mixed = false,
    label,
    disabled,
    onToggle,
}: {
    checked: boolean
    mixed?: boolean
    label: string
    disabled?: boolean
    onToggle: (shift: boolean) => void
}) {
    return (
        <label
            className="dt-checkbox relative grid size-full cursor-pointer place-items-center"
            data-table-interactive
            onClick={(event) => event.stopPropagation()}
        >
            <input
                type="checkbox"
                className="peer absolute inset-0 m-0 size-full cursor-[inherit] opacity-0"
                checked={checked}
                disabled={disabled}
                aria-label={label}
                ref={(node) => {
                    if (node) node.indeterminate = mixed
                }}
                onChange={() => {}}
                onClick={(event) => onToggle(event.shiftKey)}
            />
            <span
                aria-hidden="true"
                className="pointer-events-none grid size-3.5 place-items-center bg-[color-mix(in_oklab,var(--card),var(--foreground)_12%)] peer-checked:bg-primary peer-checked:text-primary-foreground peer-indeterminate:bg-primary peer-indeterminate:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ring peer-disabled:opacity-30 [&_svg]:invisible [&_svg]:size-[11px] [&_svg]:stroke-[2.5] peer-checked:[&_svg]:visible peer-indeterminate:[&_svg]:visible"
            >
                {mixed ? <Minus /> : <Check />}
            </span>
        </label>
    )
}

function HeaderPopover<T>({ column, children }: { column: DataColumn<T>; children: ReactNode }) {
    const [open, setOpen] = useState(false)
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <button
                        type="button"
                        className="dt-sort flex size-full items-center text-left -outline-offset-3"
                    />
                }
            >
                {children}
            </PopoverTrigger>
            <PopoverContent aria-label={column.header} className="w-64">
                {column.headerPopover?.(() => setOpen(false))}
            </PopoverContent>
        </Popover>
    )
}

function ColumnHeader<T>({
    layout,
    table,
}: {
    layout: ColumnLayout<T>
    table: DataTableController<T>
}) {
    const { column, width, style } = layout
    const t = useMessages().components.dataTable
    const drag = useRef<{ x: number; width: number } | null>(null)
    const sort =
        column.sorted ?? (table.sort?.key === column.key ? table.sort.direction : undefined)
    const onSort =
        column.onSort ?? (column.sortable ? () => table.toggleSort(column.key) : undefined)
    const label = (
        <span className="dt-header-label flex items-center gap-[7px] truncate [&>svg]:size-[13px] [&>svg]:shrink-0 [&>svg]:opacity-70">
            {column.icon}
            {column.header}
        </span>
    )
    return (
        <div
            role="columnheader"
            aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined}
            className={`dt-cell flex min-w-0 items-center px-3.5 data-[align=right]:justify-end data-[align=right]:text-right data-[align=right]:tabular-nums dt-column-header bg-card text-[11px] font-medium text-muted-foreground [&:last-child_.dt-resize]:right-0 [&:last-child_.dt-resize]:after:left-auto [&:last-child_.dt-resize]:after:right-0 ${column.pinned ? 'dt-pinned sticky z-2 [&:not(.dt-check-cell)]:@max-[600px]/table:relative [&:not(.dt-check-cell)]:@max-[600px]/table:inset-auto!' : 'relative'}`}
            style={style}
            data-align={column.align}
        >
            {onSort ? (
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <button
                                type="button"
                                className="dt-sort group/sort flex size-full items-center justify-between gap-1.5 text-left -outline-offset-3 [&>svg]:size-3 [&>svg]:shrink-0"
                                onClick={onSort}
                            />
                        }
                    >
                        {label}
                        {sort === 'asc' ? (
                            <ArrowUp />
                        ) : sort === 'desc' ? (
                            <ArrowDown />
                        ) : (
                            <ArrowUpDown className="dt-sort-idle opacity-0 group-hover/sort:opacity-70 group-focus-visible/sort:opacity-70" />
                        )}
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>
                        {t.sortBy(column.header)}
                    </TooltipContent>
                </Tooltip>
            ) : column.headerPopover ? (
                <HeaderPopover column={column}>{label}</HeaderPopover>
            ) : column.headerTooltip ? (
                <Tooltip>
                    <TooltipTrigger render={<span className="flex size-full items-center" />}>
                        {label}
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>
                        {column.headerTooltip}
                    </TooltipContent>
                </Tooltip>
            ) : (
                label
            )}
            {column.resizable !== false && (
                <div
                    role="separator"
                    tabIndex={0}
                    aria-label={t.resize(column.header)}
                    aria-orientation="vertical"
                    aria-valuenow={Math.round(width)}
                    aria-valuemin={Math.max(48, column.minWidth ?? 100)}
                    aria-valuemax={Math.max(column.minWidth ?? 100, column.maxWidth ?? 800)}
                    className="dt-resize absolute inset-y-0 -right-[3px] z-3 w-[7px] cursor-col-resize touch-none -outline-offset-2 after:absolute after:inset-y-[7px] after:left-[3px] after:w-px after:bg-transparent after:content-[''] hover:after:bg-foreground active:after:bg-foreground focus-visible:after:bg-foreground"
                    onDoubleClick={() => table.setColumnWidth(column.key, column.width ?? 180)}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                            event.preventDefault()
                            event.stopPropagation()
                            table.setColumnWidth(
                                column.key,
                                width +
                                    (event.key === 'ArrowRight' ? 1 : -1) *
                                        (event.shiftKey ? 40 : 10),
                            )
                        }
                    }}
                    onPointerDown={(event) => {
                        if (event.button !== 0) return
                        event.preventDefault()
                        event.stopPropagation()
                        drag.current = { x: event.clientX, width }
                        event.currentTarget.setPointerCapture(event.pointerId)
                    }}
                    onPointerMove={(event) => {
                        if (drag.current)
                            table.setColumnWidth(
                                column.key,
                                drag.current.width + event.clientX - drag.current.x,
                            )
                    }}
                    onPointerUp={(event) => {
                        drag.current = null
                        if (event.currentTarget.hasPointerCapture(event.pointerId))
                            event.currentTarget.releasePointerCapture(event.pointerId)
                    }}
                    onLostPointerCapture={() => {
                        drag.current = null
                    }}
                />
            )}
        </div>
    )
}

function isInteractive(target: EventTarget | null) {
    return (
        target instanceof Element &&
        !!target.closest(
            'button, input, a, select, textarea, [contenteditable=true], [role=checkbox], [role=menu], [role=menuitem], [role=listbox], [data-table-interactive]',
        )
    )
}

function typing(target: EventTarget | null) {
    return (
        target instanceof Element &&
        !!target.closest(
            'input:not([type=checkbox]), textarea, select, [contenteditable=true], [role=menu]',
        )
    )
}

function menuItems<T>(
    actions: readonly DataTableActionDef<T>[],
    context: DataTableActionContext<T>,
): MenuItem[] {
    return resolveActions(actions, context).map(({ action, disabled, reason }) => ({
        key: action.key,
        label: action.label,
        icon: action.icon,
        keys: action.keys,
        group: action.group,
        variant: action.variant,
        disabled: disabled && (reason ?? true),
        onSelect: () => action.onClick(context),
    }))
}

const emptyClasses =
    'dt-empty sticky left-0 h-[calc(100%-var(--dt-head-height))] min-h-0 p-0 text-muted-foreground [&>svg]:size-[23px] [&>svg]:opacity-50'
const cellClasses =
    'dt-cell bg-[var(--dt-row-bg,var(--card))] flex min-w-0 items-center px-3.5 data-[align=right]:text-right data-[align=right]:tabular-nums'
const pinnedClasses =
    'dt-pinned sticky z-2 [&:not(.dt-check-cell)]:@max-[600px]/table:relative [&:not(.dt-check-cell)]:@max-[600px]/table:inset-auto!'
const rowStateClasses =
    "outline-none select-none [--dt-row-bg:var(--card)] hover:[--dt-row-bg:var(--dt-hover)] aria-selected:[--dt-row-bg:var(--dt-selected)] data-openable:cursor-pointer data-dragging:opacity-50 data-dimmed:opacity-50 data-drop:[--dt-row-bg:var(--dt-selected)] data-drop:after:pointer-events-none data-drop:after:absolute data-drop:after:inset-0 data-drop:after:z-4 data-drop:after:border data-drop:after:border-primary data-drop:after:content-['']"

function TableViewport<T>({
    table,
    rows,
    label,
    getRowLabel,
    onRowActivate,
    tile,
    loading,
    error,
    onRetry,
    emptyState,
    pagination,
    totalCount,
    rowDrag,
    rowDrop,
    rowGroup,
    actions,
    menuTitle,
    dimmed,
    onPaste,
    text: ownText,
}: DataTableProps<T>) {
    'use no memo'
    const t = useMessages()
    const format = useFormat()
    const text = ownText ?? t.components.table
    const scrollRef = useRef<HTMLDivElement>(null)
    const sentinelRef = useRef<HTMLDivElement>(null)
    const anchorRef = useRef<string | null>(null)
    const requestRef = useRef(false)
    const attemptedCursor = useRef<string | null>(null)
    const [focusedId, setFocusedId] = useState<string | null>(null)
    useFocusPaste(scrollRef, onPaste)
    const [dropId, setDropId] = useState<string | null>(null)
    const [dragging, setDragging] = useState<ReadonlySet<string>>(new Set())
    const [menuRow, setMenuRow] = useState<string | null>(null)
    const menuTarget = useMenuTarget()
    const [viewportWidth, setViewportWidth] = useState(0)
    const dragSession = useContext(DragContext)
    const dragScroll = useDragScroll(scrollRef)
    const selectable = table.selectable !== false
    const grid = table.view === 'grid' && !!tile
    const tileWidth = TILE_WIDTH[table.tileSize]
    const tileHeight = tileWidth + TILE_LABEL
    const perRow = grid ? tilesPerRow(viewportWidth, tileWidth) : 1
    const headerHeight = grid ? 0 : HEADER_HEIGHT
    const { getRowId, selectable: selectionPolicy } = table
    const enabledIds = useMemo(
        () =>
            rows
                .filter((row) => typeof selectionPolicy !== 'function' || selectionPolicy(row))
                .map(getRowId),
        [rows, selectionPolicy, getRowId],
    )
    const enabledSet = useMemo(() => new Set(enabledIds), [enabledIds])
    const selectedCount = enabledIds.reduce(
        (count, id) => count + Number(table.selection.has(id)),
        0,
    )
    const layout = columnLayout(table.visibleColumns, table.columnWidths, selectable)
    const rowHeight = ROW_HEIGHT
    const itemHeight = grid ? tileHeight + TILE_GAP : rowHeight
    const focusedIndex =
        focusedId === null ? -1 : rows.findIndex((row) => table.getRowId(row) === focusedId)
    const items = useMemo(() => {
        if (grid || !rowGroup) return null
        const list: ({ row: number } | { heading: string })[] = []
        let previous = ''
        rows.forEach((row, index) => {
            const group = rowGroup(row)
            if (group !== previous && group) list.push({ heading: group })
            previous = group
            list.push({ row: index })
        })
        return list
    }, [rows, rowGroup, grid])
    const rowItem = useMemo(() => {
        if (!items) return null
        const map: number[] = []
        items.forEach((item, index) => {
            if ('row' in item) map[item.row] = index
        })
        return map
    }, [items])
    const itemOf = (rowIndex: number) =>
        rowItem ? rowItem[rowIndex] : Math.floor(rowIndex / perRow)
    const itemCount = items ? items.length : Math.ceil(rows.length / perRow)
    const getItemKey = useCallback(
        (index: number) => {
            const item = items?.[index]
            if (item && 'heading' in item) return `heading:${index}:${item.heading}`
            return getRowId(rows[item ? item.row : index * perRow])
        },
        [rows, getRowId, perRow, items],
    )
    const virtualizer = useVirtualizer({
        count: itemCount,
        getScrollElement: () => scrollRef.current,
        getItemKey,
        estimateSize: () => itemHeight,
        overscan: 8,
        scrollMargin: headerHeight,
        scrollPaddingStart: headerHeight,
        directDomUpdates: true,
        directDomUpdatesMode: 'position',
        rangeExtractor: useCallback(
            (range) => {
                const indices = defaultRangeExtractor(range)
                const focusedItem =
                    focusedIndex < 0
                        ? -1
                        : (rowItem?.[focusedIndex] ?? Math.floor(focusedIndex / perRow))
                if (focusedIndex >= 0 && !indices.includes(focusedItem)) indices.push(focusedItem)
                return indices.sort((a, b) => a - b)
            },
            [focusedIndex, perRow, rowItem],
        ),
    })

    useLayoutEffect(() => {
        virtualizer.measure()
    }, [itemHeight, perRow, virtualizer])
    useLayoutEffect(() => {
        const element = scrollRef.current
        if (!element) return
        setViewportWidth(element.clientWidth)
        const observer = new ResizeObserver(() => setViewportWidth(element.clientWidth))
        observer.observe(element)
        return () => observer.disconnect()
    }, [])
    useLayoutEffect(() => {
        const element = scrollRef.current
        if (element)
            element.scrollTop = Math.min(
                element.scrollTop,
                Math.max(0, element.scrollHeight - element.clientHeight),
            )
    }, [rows.length])

    const loadMore = useCallback(
        async (retry = false) => {
            if (
                !pagination ||
                pagination.nextCursor === null ||
                pagination.isFetchingNextPage ||
                requestRef.current
            )
                return
            if (!retry && (pagination.error || attemptedCursor.current === pagination.nextCursor))
                return
            requestRef.current = true
            attemptedCursor.current = pagination.nextCursor
            try {
                await pagination.fetchNextPage()
            } catch {
            } finally {
                requestRef.current = false
            }
        },
        [pagination],
    )

    useEffect(() => {
        const element = sentinelRef.current
        const root = scrollRef.current
        if (!element || !root || !pagination || pagination.nextCursor === null || pagination.error)
            return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) void loadMore()
            },
            { root, rootMargin: '0px 0px 240px 0px' },
        )
        observer.observe(element)
        return () => observer.disconnect()
    }, [pagination, rows.length, loadMore])

    const toggle = (id: string, shift: boolean) => {
        table.setSelection(selectRange(table.selection, enabledIds, anchorRef.current, id, shift))
        anchorRef.current = id
    }
    const plain = { shiftKey: false, metaKey: false, ctrlKey: false }
    const modified = (event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) =>
        event.shiftKey || event.metaKey || event.ctrlKey
    const select = (
        id: string,
        event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
    ) => {
        if (!selectable || !enabledSet.has(id)) return
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
            toggle(id, event.shiftKey)
            return
        }
        table.setSelection(new Set([id]))
        anchorRef.current = id
    }
    const activate = (
        row: T,
        id: string,
        event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; detail?: number },
    ) => {
        if ((event.detail ?? 0) > 1) return
        if (modified(event)) {
            select(id, event)
            return
        }
        if (selectable && !enabledSet.has(id)) return
        select(id, event)
        onRowActivate?.(row)
    }
    const dragProps = (row: T, id: string) => {
        if (!rowDrag) return undefined
        return {
            draggable: true,
            onDragStart: (event: DragEvent<HTMLElement>) => {
                if (isInteractive(event.target)) {
                    event.preventDefault()
                    return
                }
                const dragged = table.selection.has(id)
                    ? rows.filter((item) => table.selection.has(getRowId(item)))
                    : [row]
                const start = rowDrag(dragged)
                if (!start) {
                    event.preventDefault()
                    return
                }
                dragSession?.begin(start.type, start.payload)
                event.dataTransfer.effectAllowed = 'copyMove'
                event.dataTransfer.setData(start.type, JSON.stringify(start.payload))
                event.dataTransfer.setData('text/plain', start.label)
                chipDragImage(event.dataTransfer, start.label, dragged.length)
                setDragging(new Set(dragged.map(getRowId)))
            },
            onDragEnd: () => {
                dragSession?.end()
                setDropId(null)
                setDragging(new Set())
            },
        }
    }
    const dropProps = (row: T, id: string) => {
        const spec = rowDrop?.(row)
        if (!spec) return undefined
        const decide = (event: DragEvent<HTMLElement>) => dropDecision(event, spec)
        return {
            onDragOver: (event: DragEvent<HTMLElement>) => {
                const effect = decide(event)
                if (!effect) return
                event.preventDefault()
                event.stopPropagation()
                event.dataTransfer.dropEffect = effect
                const hint = hintOf(event, spec, effect)
                dragSession?.hint(t.components.drag[hint.action](hint.label))
                if (dropId !== id) setDropId(id)
            },
            onDragLeave: (event: DragEvent<HTMLElement>) => {
                if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null))
                    setDropId((current) => (current === id ? null : current))
            },
            onDrop: (event: DragEvent<HTMLElement>) => {
                const effect = decide(event)
                setDropId(null)
                if (!effect) return
                event.preventDefault()
                event.stopPropagation()
                land(event, spec, effect)
            },
        }
    }
    const rowMenu = (row: T, id: string, label: string) => {
        if (!actions?.length) return undefined
        return menuTarget((): MenuRequest | undefined => {
            if (typeof selectionPolicy === 'function' && !selectionPolicy(row)) return undefined
            const inside = table.selection.has(id)
            const context = inside
                ? actionContext(table.selection, rows, getRowId, 'menu')
                : actionContext(new Set([id]), [row], getRowId, 'menu')
            return {
                title: menuTitle?.(context.selectedRows) ?? label,
                items: menuItems(actions, context),
                onOpenChange: (open) => {
                    if (!inside) setMenuRow(open ? id : null)
                },
            }
        })
    }
    const focusRow = (index: number) => {
        const target = Math.max(0, Math.min(rows.length - 1, index))
        if (!rows[target]) return
        setFocusedId(table.getRowId(rows[target]))
        virtualizer.scrollToIndex(itemOf(target), { align: 'auto' })
        requestAnimationFrame(() => {
            scrollRef.current
                ?.querySelector<HTMLElement>(`[data-row-index="${target}"]`)
                ?.focus({ preventScroll: true })
        })
    }
    const extendSelection = (from: string, to: number) => {
        if (anchorRef.current === null) anchorRef.current = from
        const ids = selectRange(
            new Set(),
            enabledIds,
            anchorRef.current,
            table.getRowId(rows[to]),
            true,
        )
        table.setSelection(new Set([...table.selection, ...ids]))
    }
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number, id: string) => {
        if (isInteractive(event.target)) return
        if (actions?.length && isMenuKey(event)) {
            event.preventDefault()
            openMenuFrom(event.currentTarget)
            return
        }
        const step =
            event.key === 'ArrowDown'
                ? perRow
                : event.key === 'ArrowUp'
                  ? -perRow
                  : grid && event.key === 'ArrowRight'
                    ? 1
                    : grid && event.key === 'ArrowLeft'
                      ? -1
                      : 0
        const move = (target: number) => {
            const next = Math.max(0, Math.min(rows.length - 1, target))
            if (event.shiftKey && selectable) extendSelection(id, next)
            else if (!event.metaKey && !event.ctrlKey && rows[next])
                select(table.getRowId(rows[next]), plain)
            focusRow(next)
        }
        if (step) {
            event.preventDefault()
            move(index + step)
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            move(event.key === 'Home' ? 0 : rows.length - 1)
        } else if (event.key === 'PageDown' || event.key === 'PageUp') {
            event.preventDefault()
            const page =
                Math.max(
                    1,
                    Math.floor(
                        ((scrollRef.current?.clientHeight ?? 400) - headerHeight) / itemHeight,
                    ),
                ) * perRow
            move(index + (event.key === 'PageDown' ? page : -page))
        } else if (event.key === ' ' && selectable && enabledSet.has(id)) {
            event.preventDefault()
            toggle(id, event.shiftKey)
        } else if (event.key === 'Enter') {
            event.preventDefault()
            activate(rows[index], id, plain)
        }
    }
    const failure = !!pagination?.error
    const styles = {
        '--dt-columns': layout.template,
        '--dt-min-width': `${layout.minWidth}px`,
        '--dt-row-height': `${rowHeight}px`,
        '--dt-head-height': `${headerHeight}px`,
        '--dt-tile-width': `${tileWidth}px`,
        '--dt-tile-height': `${tileHeight}px`,
        '--dt-per-row': perRow,
    } as CSSProperties
    const rowCount =
        pagination?.nextCursor != null
            ? totalCount === undefined
                ? -1
                : Math.ceil(totalCount / perRow) + Number(!grid)
            : itemCount + Number(!grid)

    const renderTile = (row: T, index: number, column: number) => {
        const id = table.getRowId(row)
        const rowLabel = getRowLabel?.(row) ?? t.components.dataTable.item(format.number(index + 1))
        const selected = table.selection.has(id)
        return (
            <div
                key={id}
                role="gridcell"
                aria-colindex={column + 1}
                aria-selected={selectable ? selected : undefined}
                aria-label={rowLabel}
                data-row-index={index}
                data-openable={selectable || !!onRowActivate || undefined}
                data-drop={dropId === id || undefined}
                data-dragging={dragging.has(id) || undefined}
                data-dimmed={dimmed?.(row) || undefined}
                data-menu={menuRow === id || undefined}
                {...dragProps(row, id)}
                {...dropProps(row, id)}
                {...rowMenu(row, id, rowLabel)}
                tabIndex={focusedIndex === index || (focusedIndex < 0 && index === 0) ? 0 : -1}
                className={`dt-tile group/tile relative flex h-(--dt-tile-height) w-(--dt-tile-width) flex-col bg-(--dt-row-bg) p-2 ${rowStateClasses} focus-visible:ring-1 focus-visible:ring-ring data-menu:ring-1 data-menu:ring-ring`}
                onFocus={() => setFocusedId(id)}
                onClick={(event) => {
                    if (isInteractive(event.target)) return
                    event.currentTarget.focus({ preventScroll: true })
                    activate(row, id, event)
                }}
                onKeyDown={(event) => onKeyDown(event, index, id)}
            >
                {selectable && (
                    <div
                        className="dt-tile-check absolute top-3 left-3 z-2 size-6 bg-(--dt-row-bg) opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 data-[shown=true]:opacity-100"
                        data-shown={selected || table.selection.size > 0 || undefined}
                    >
                        <SelectionCheckbox
                            label={t.components.dataTable.select(rowLabel)}
                            checked={selected}
                            disabled={!enabledSet.has(id)}
                            onToggle={(shift) => toggle(id, shift)}
                        />
                    </div>
                )}
                <div className="dt-tile-content flex min-h-0 flex-1 flex-col">
                    {tile!(row, table.tileSize)}
                </div>
            </div>
        )
    }

    const skeleton = (count: number) =>
        grid ? (
            <div
                className="dt-skeleton grid grid-cols-[repeat(var(--dt-per-row),var(--dt-tile-width))] justify-between gap-3 p-3 [&>i]:block [&>i]:h-(--dt-tile-height) [&>i]:bg-muted [&>i]:animate-pulse motion-reduce:[&>i]:animate-none"
                role="status"
                aria-label={text.loading}
            >
                {Array.from({ length: perRow * count }, (_, index) => (
                    <i key={index} />
                ))}
            </div>
        ) : (
            <div
                className="dt-skeleton overflow-hidden [&>div]:grid [&>div]:grid-cols-[2fr_1fr_1fr] [&>div]:items-center [&>div]:gap-12 [&>div]:px-[22px] [&_i]:h-[7px] [&_i]:bg-muted [&_i]:animate-pulse motion-reduce:[&_i]:animate-none [&>div:nth-child(even)_i]:w-[70%]"
                role="status"
                aria-label={text.loading}
            >
                {Array.from({ length: count }, (_, index) => (
                    <div key={index} style={{ height: rowHeight }}>
                        <i />
                        <i />
                        <i />
                    </div>
                ))}
            </div>
        )

    return (
        <div
            className="dt-viewport relative min-h-0 flex-1 overflow-auto outline-none overscroll-contain scroll-pt-(--dt-head-height) [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [overflow-anchor:none]"
            ref={scrollRef}
            style={styles}
            tabIndex={-1}
            {...dragScroll}
            onKeyDown={(event) => {
                if (actions && !event.defaultPrevented && !typing(event.target)) {
                    const index = Number(
                        (event.target as Element)
                            .closest('[data-row-index]')
                            ?.getAttribute('data-row-index') ?? -1,
                    )
                    const focused = rows[index]
                    const alone =
                        focused !== undefined &&
                        !table.selection.has(getRowId(focused)) &&
                        (typeof selectionPolicy !== 'function' || selectionPolicy(focused))
                    const context = alone
                        ? actionContext(new Set([getRowId(focused)]), [focused], getRowId, 'keys')
                        : actionContext(table.selection, rows, getRowId, 'keys')
                    const bound = resolveActions(
                        actions.filter(
                            (action) =>
                                action.keys && !action.nativeKeys && matchesKey(action.keys, event),
                        ),
                        context,
                    ).find((item) => !item.disabled)
                    if (bound) {
                        event.preventDefault()
                        bound.action.onClick(context)
                        return
                    }
                }
                if (isInteractive(event.target)) return
                if (event.key === 'Escape') {
                    event.stopPropagation()
                    table.clearSelection()
                }
                if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key.toLowerCase() === 'a' &&
                    selectable
                ) {
                    event.preventDefault()
                    table.setSelection(new Set([...table.selection, ...enabledIds]))
                }
            }}
        >
            <div
                role="grid"
                aria-label={label}
                aria-rowcount={rowCount}
                aria-colcount={grid ? perRow : layout.layouts.length + Number(selectable)}
                aria-multiselectable={selectable || undefined}
                aria-busy={loading || undefined}
                className={grid ? 'dt-grid' : 'dt-grid min-w-(--dt-min-width)'}
                data-view={table.view}
            >
                {!grid && (
                    <div
                        role="rowgroup"
                        className="dt-head sticky top-0 z-5 border-b bg-card [&>.dt-grid-row]:h-[calc(var(--dt-head-height)-1px)]"
                    >
                        <div
                            role="row"
                            aria-rowindex={1}
                            className="dt-grid-row grid w-full grid-cols-(--dt-columns)"
                        >
                            {selectable && (
                                <div
                                    role="columnheader"
                                    className={`${cellClasses} dt-check-cell justify-center px-0! ${pinnedClasses}`}
                                    style={{ left: 0 }}
                                >
                                    <SelectionCheckbox
                                        label={t.components.dataTable.selectAll}
                                        checked={
                                            enabledIds.length > 0 &&
                                            selectedCount === enabledIds.length
                                        }
                                        mixed={
                                            selectedCount > 0 && selectedCount < enabledIds.length
                                        }
                                        disabled={!enabledIds.length}
                                        onToggle={() => {
                                            anchorRef.current = null
                                            table.setSelection(
                                                toggleLoaded(table.selection, enabledIds),
                                            )
                                        }}
                                    />
                                </div>
                            )}
                            {layout.layouts.map((item) => (
                                <ColumnHeader key={item.column.key} layout={item} table={table} />
                            ))}
                        </div>
                    </div>
                )}
                <div role="rowgroup" ref={virtualizer.containerRef} className="dt-body relative">
                    {virtualizer.getVirtualItems().map((item) => {
                        if (grid) {
                            const start = item.index * perRow
                            const chunk = rows.slice(start, start + perRow)
                            return (
                                <div
                                    key={item.key}
                                    ref={virtualizer.measureElement}
                                    data-index={item.index}
                                    role="row"
                                    aria-rowindex={item.index + 1}
                                    className="dt-tile-row absolute top-0 left-0 grid w-full grid-cols-[repeat(var(--dt-per-row),var(--dt-tile-width))] justify-between gap-x-3 px-3 pt-3"
                                >
                                    {chunk.map((row, column) =>
                                        renderTile(row, start + column, column),
                                    )}
                                </div>
                            )
                        }
                        const entry = items?.[item.index]
                        if (entry && 'heading' in entry)
                            return (
                                <div
                                    key={item.key}
                                    ref={virtualizer.measureElement}
                                    data-index={item.index}
                                    role="row"
                                    aria-rowindex={item.index + 2}
                                    className="dt-group-row absolute top-0 left-0 flex h-9 w-full items-end bg-(--dt-row-bg) pb-1.5"
                                >
                                    <div
                                        role="rowheader"
                                        className="sticky left-0 px-3.5 text-[11px] font-medium text-muted-foreground"
                                    >
                                        {entry.heading}
                                    </div>
                                </div>
                            )
                        const rowIndex = entry ? entry.row : item.index
                        const row = rows[rowIndex]
                        const id = table.getRowId(row)
                        const rowLabel =
                            getRowLabel?.(row) ??
                            t.components.dataTable.row(format.number(rowIndex + 1))
                        return (
                            <div
                                key={item.key}
                                ref={virtualizer.measureElement}
                                data-index={item.index}
                                data-row-index={rowIndex}
                                role="row"
                                aria-rowindex={item.index + 2}
                                aria-selected={selectable ? table.selection.has(id) : undefined}
                                tabIndex={
                                    focusedIndex === rowIndex ||
                                    (focusedIndex < 0 && rowIndex === 0)
                                        ? 0
                                        : -1
                                }
                                className={`dt-grid-row group/row grid w-full grid-cols-(--dt-columns) dt-row absolute top-0 left-0 h-(--dt-row-height) bg-(--dt-row-bg) ${rowStateClasses} focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-0 focus-visible:after:z-4 focus-visible:after:border focus-visible:after:border-ring focus-visible:after:content-[''] data-menu:after:pointer-events-none data-menu:after:absolute data-menu:after:inset-0 data-menu:after:z-4 data-menu:after:border data-menu:after:border-ring data-menu:after:content-[''] [&[aria-selected=true]>.dt-cell:first-child]:before:absolute [&[aria-selected=true]>.dt-cell:first-child]:before:left-0 [&[aria-selected=true]>.dt-cell:first-child]:before:inset-y-[9px] [&[aria-selected=true]>.dt-cell:first-child]:before:w-0.5 [&[aria-selected=true]>.dt-cell:first-child]:before:bg-primary [&[aria-selected=true]>.dt-cell:first-child]:before:content-['']`}
                                data-openable={selectable || !!onRowActivate || undefined}
                                data-drop={dropId === id || undefined}
                                data-dragging={dragging.has(id) || undefined}
                                data-dimmed={dimmed?.(row) || undefined}
                                data-menu={menuRow === id || undefined}
                                {...dragProps(row, id)}
                                {...dropProps(row, id)}
                                {...rowMenu(row, id, rowLabel)}
                                onFocus={() => setFocusedId(id)}
                                onClick={(event) => {
                                    if (isInteractive(event.target)) return
                                    event.currentTarget.focus({ preventScroll: true })
                                    activate(row, id, event)
                                }}
                                onKeyDown={(event) => onKeyDown(event, rowIndex, id)}
                            >
                                {selectable && (
                                    <div
                                        role="gridcell"
                                        aria-colindex={1}
                                        className={`${cellClasses} dt-check-cell justify-center px-0! ${pinnedClasses} ${table.selection.size ? '' : quietCheckbox}`}
                                        style={{ left: 0 }}
                                    >
                                        <SelectionCheckbox
                                            label={t.components.dataTable.select(rowLabel)}
                                            checked={table.selection.has(id)}
                                            disabled={!enabledSet.has(id)}
                                            onToggle={(shift) => toggle(id, shift)}
                                        />
                                    </div>
                                )}
                                {layout.layouts.map(({ column, style }, columnIndex) => (
                                    <div
                                        key={column.key}
                                        role="gridcell"
                                        aria-colindex={columnIndex + 1 + Number(selectable)}
                                        className={`${cellClasses} ${column.pinned ? pinnedClasses : 'relative'}`}
                                        style={style}
                                        data-align={column.align}
                                    >
                                        <div className="dt-cell-content w-full min-w-0 truncate">
                                            {column.cell(row)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            </div>
            {loading && !rows.length ? (
                skeleton(grid ? 3 : 9)
            ) : error && !rows.length ? (
                <EmptyState className={emptyClasses} role="alert">
                    <RotateCcw />
                    <strong>{text.failed}</strong>
                    <p>{errorMessage(error, t)}</p>
                    {onRetry && (
                        <Button size="sm" onClick={onRetry}>
                            {t.common.retry}
                        </Button>
                    )}
                </EmptyState>
            ) : !rows.length && pagination?.nextCursor == null ? (
                <EmptyState className={emptyClasses}>
                    {emptyState ?? (
                        <>
                            <Inbox />
                            <span>{text.empty}</span>
                        </>
                    )}
                </EmptyState>
            ) : null}
            {!!error && rows.length > 0 && (
                <div
                    className="dt-load-state sticky left-0 flex h-12 items-center justify-center gap-2.5 text-muted-foreground"
                    role="alert"
                >
                    <span>{text.refreshFailed}</span>
                    {onRetry && (
                        <Button size="xs" onClick={onRetry}>
                            {t.common.retryShort}
                        </Button>
                    )}
                </div>
            )}
            {pagination?.nextCursor != null && (
                <div ref={sentinelRef} className="dt-sentinel h-px" />
            )}
            {rows.length > 0 && pagination?.isFetchingNextPage && !failure
                ? skeleton(grid ? 1 : 3)
                : null}
            {failure && (
                <div
                    className="dt-load-state sticky left-0 flex h-12 items-center justify-center gap-2.5 text-muted-foreground"
                    role="alert"
                >
                    <span>{text.moreFailed}</span>
                    {pagination?.nextCursor != null ? (
                        <Button size="xs" onClick={() => void loadMore(true)}>
                            {t.common.retryShort}
                        </Button>
                    ) : onRetry ? (
                        <Button size="xs" onClick={onRetry}>
                            {t.common.retry}
                        </Button>
                    ) : null}
                </div>
            )}
        </div>
    )
}

export function DataTable<T>(props: DataTableProps<T>) {
    const id = useId()
    const {
        rows,
        totalCount,
        text,
        toolbar,
        footer,
        table,
        accent,
        flat,
        actions: menuActions,
        className = '',
    } = props
    const t = useMessages()
    const format = useFormat()
    const total = totalCount !== undefined && totalCount > rows.length ? totalCount : undefined
    const viewport = <TableViewport key={props.resetKey ?? id} {...props} />
    const emptyMenu = (): MenuRequest | undefined =>
        menuActions && {
            title: props.menuTitle?.([]) ?? props.label,
            items: menuItems(menuActions, actionContext(new Set(), rows, table.getRowId, 'menu')),
        }
    return (
        <section
            className={`${flat ? flatSurfaceClasses : surfaceClasses} data-table @container/table isolate flex h-full min-h-0 min-w-0 flex-col overflow-hidden text-xs text-foreground dark:scheme-dark [&[data-view=grid]_.dt-toolbar]:relative [&[data-view=grid]_.dt-toolbar]:z-1 [--dt-line:color-mix(in_oklab,var(--border),transparent_30%)] [--dt-hover:color-mix(in_oklab,var(--card),var(--foreground)_3.5%)] [--dt-selected:color-mix(in_oklab,var(--card),var(--primary)_16%)] ${className}`}
            aria-label={props.label}
            data-view={props.tile ? table.view : 'list'}
            data-accent={accent ? 'true' : undefined}
        >
            {toolbar}
            {menuActions?.length ? (
                <ActionMenuArea fallback={emptyMenu}>{viewport}</ActionMenuArea>
            ) : (
                viewport
            )}
            <footer className="dt-footer flex min-h-[35px] shrink-0 items-center justify-between gap-3 border-t bg-card px-3.5 py-[7px] text-[10px] text-muted-foreground @max-[600px]/table:flex-wrap @max-[600px]/table:gap-x-2.5 @max-[600px]/table:gap-y-1 @max-[600px]/table:px-2.5">
                <span role="status" className="dt-count shrink-0 tabular-nums">
                    {(text ?? t.components.table).count(
                        total ?? rows.length,
                        format.number(rows.length),
                        total === undefined ? undefined : format.number(total),
                        props.pagination?.nextCursor != null && totalCount === undefined,
                    )}
                </span>
                <div className="dt-footer-content min-w-0 overflow-hidden">{footer}</div>
            </footer>
        </section>
    )
}
