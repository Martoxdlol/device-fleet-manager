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
    searchable?: boolean
    search?: string
    onSearchChange?: (search: string) => void
    filter?: ((item: T, search: string) => boolean) | null
    renderItem?: (item: T) => ReactNode
    getItemGroup?: (item: T) => string | undefined
    renderValue?: (item: T | null) => ReactNode
    triggerClassName?: string
    indicator?: boolean
    side?: 'bottom' | 'right'
    sideOffset?: number
    actions?: readonly {
        label: string
        icon?: ReactNode
        detail?: string
        onClick: () => void
    }[]
    header?: ReactNode
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
    resetKey?: string
    emptyState?: ReactNode
    text?: ListText
    className?: string
    popupClassName?: string
    itemHeight?: number
}

export interface MultiComboboxProps<T> extends Omit<
    ComboboxProps<T>,
    'value' | 'onValueChange' | 'clearable' | 'renderValue'
> {
    value: T[]
    onValueChange: (value: T[]) => void
}

export interface ComboboxDataOptions<T> {
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
