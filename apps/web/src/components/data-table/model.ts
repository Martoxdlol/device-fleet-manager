import type { ColumnLayout, DataColumn, TableSort } from './types'

export const SELECTION_WIDTH = 42
/** Rendered height of the sticky head, its bottom border included. */
export const HEADER_HEIGHT = 39
export const ROW_HEIGHT = 36
/** Tile width per size; the tile is a square media box plus a two-line label. */
export const TILE_WIDTH = { sm: 96, md: 144, lg: 208 }
export const TILE_LABEL = 38
export const TILE_GAP = 12
export const GRID_PADDING = 12

export function tilesPerRow(viewportWidth: number, tileWidth: number) {
    return Math.max(
        1,
        Math.floor((viewportWidth - 2 * GRID_PADDING + TILE_GAP) / (tileWidth + TILE_GAP)),
    )
}

export function columnWidth<T>(column: DataColumn<T>, width = column.width ?? 180) {
    const min = Math.max(48, column.minWidth ?? 100)
    return Math.min(Math.max(min, column.maxWidth ?? 800), Math.max(min, width))
}

/** Pinned offsets and grid tracks share the exact same widths. */
export function columnLayout<T>(
    columns: readonly DataColumn<T>[],
    widths: Readonly<Record<string, number>>,
    selectable: boolean,
) {
    const ordered = [
        ...columns.filter((c) => c.pinned === 'left'),
        ...columns.filter((c) => !c.pinned),
        ...columns.filter((c) => c.pinned === 'right'),
    ]
    let left = selectable ? SELECTION_WIDTH : 0
    const layouts: ColumnLayout<T>[] = ordered.map((column) => {
        const width = columnWidth(column, widths[column.key])
        const style = column.pinned === 'left' ? { left } : {}
        if (column.pinned === 'left') left += width
        return { column, width, style }
    })
    let right = 0
    for (let index = layouts.length - 1; index >= 0; index--) {
        const layout = layouts[index]
        if (layout.column.pinned === 'right') {
            layout.style = { right }
            right += layout.width
        }
    }
    const growIndex = ordered.findLastIndex((c) => !c.pinned)
    const tracks = layouts.map((layout, index) =>
        index === growIndex ? `minmax(${layout.width}px, 1fr)` : `${layout.width}px`,
    )
    if (selectable) tracks.unshift(`${SELECTION_WIDTH}px`)
    return {
        layouts,
        template: tracks.join(' '),
        minWidth: layouts.reduce(
            (sum, layout) => sum + layout.width,
            selectable ? SELECTION_WIDTH : 0,
        ),
    }
}

export function nextSort(sort: TableSort, key: string): TableSort {
    return sort?.key !== key
        ? { key, direction: 'asc' }
        : sort.direction === 'asc'
          ? { key, direction: 'desc' }
          : null
}

/** A range follows the displayed order, skips disabled rows, and supports deselection. */
export function selectRange(
    selection: ReadonlySet<string>,
    ids: readonly string[],
    anchor: string | null,
    target: string,
    range: boolean,
) {
    const next = new Set(selection)
    const start = anchor === null ? -1 : ids.indexOf(anchor)
    const end = ids.indexOf(target)
    if (end < 0) return next
    const affected =
        range && start >= 0 ? ids.slice(Math.min(start, end), Math.max(start, end) + 1) : [target]
    const remove = selection.has(target)
    for (const id of affected) {
        if (remove) next.delete(id)
        else next.add(id)
    }
    return next
}

export function toggleLoaded(selection: ReadonlySet<string>, ids: readonly string[]) {
    const next = new Set(selection)
    const all = ids.length > 0 && ids.every((id) => selection.has(id))
    for (const id of ids) {
        if (all) next.delete(id)
        else next.add(id)
    }
    return next
}
