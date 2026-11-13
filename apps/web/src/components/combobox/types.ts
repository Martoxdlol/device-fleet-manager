import type { ReactNode } from 'react'
import type { QueryKey } from '@tanstack/react-query'
import type { CursorPagination } from '../data-table/types'
import type { ListText } from '../list-text'

export interface CursorPage<T> {
    rows: T[]
    nextCursor: string | null
    totalCount?: number
}

export interface ComboboxProps<T> {
    items: readonly T[]
    value: T | null
    onValueChange: (value: T | null) => void
    getItemId: (item: T) => string
    getItemLabel: (item: T) => string
    label: string
    placeholder?: string
    searchPlaceholder?: string
    /** Disable for a small list of choices fixed in code. Data-driven lists keep search. */
    searchable?: boolean
    search?: string
    onSearchChange?: (search: string) => void
    /** Defaults to case/accent-insensitive label matching. null uses items as supplied. */
    filter?: ((item: T, search: string) => boolean) | null
    renderItem?: (item: T) => ReactNode
    /** The heading an option is listed under; options without one come first. */
    getItemGroup?: (item: T) => string | undefined
    renderValue?: (item: T | null) => ReactNode
    triggerClassName?: string
    indicator?: boolean
    side?: 'bottom' | 'right'
    sideOffset?: number
    /** Commands below the options. Each closes the popup before running. */
    actions?: readonly {
        label: string
        icon?: ReactNode
        /** Trailing text, such as a count. */
        detail?: string
        onClick: () => void
    }[]
    /** Controls above the options, such as filters that narrow them. */
    header?: ReactNode
    /** Follows the popup opening and closing, such as to fetch only while it is open. */
    onOpenChange?: (open: boolean) => void
    disabled?: boolean
    required?: boolean
    clearable?: boolean
    name?: string
    id?: string
    loading?: boolean
    error?: unknown
    onRetry?: () => void
    pagination?: CursorPagination
    /** Change when the underlying data scope changes. Search resets the viewport automatically. */
    resetKey?: string
    emptyState?: ReactNode
    /** What the list says about its options; generic results when absent. */
    text?: ListText
    className?: string
    popupClassName?: string
    /** Fixed option height; increase for custom multiline content. */
    itemHeight?: number
}

/** Several chosen options; the trigger shows the placeholder, and the choices show elsewhere. */
export interface MultiComboboxProps<T> extends Omit<
    ComboboxProps<T>,
    'value' | 'onValueChange' | 'clearable' | 'renderValue'
> {
    value: T[]
    onValueChange: (value: T[]) => void
}

export interface ComboboxDataOptions<T> {
    /** Include resource, tenant and other filters. The hook appends server search. */
    queryKey: QueryKey
    fetchPage: (context: {
        search: string
        cursor: string | null
        signal: AbortSignal
    }) => Promise<CursorPage<T>>
    getItemId: (item: T) => string
    getItemLabel: (item: T) => string
    filter?: (item: T, search: string) => boolean
    debounceMs?: number
    enabled?: boolean
}
