import {
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type RefObject,
} from 'react'
import { Combobox as Primitive } from '@base-ui/react/combobox'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '../../core/ui/button'
import { Spinner } from '../../core/ui/primitives'
import { filterItems, groupItems } from './model'
import type { ComboboxProps, MultiComboboxProps } from './types'
import { useMessages } from '../../i18n/provider'

type Scroller = { scrollToOption: (index: number) => void }
type Row<T> = { group: string } | { item: T; index: number }
type Shared<T> = Omit<ComboboxProps<T>, 'value' | 'onValueChange'>
type Selection<T> =
    | { multiple: false; value: T | null; onValueChange: (value: T | null) => void }
    | { multiple: true; value: T[]; onValueChange: (value: T[]) => void }

function OptionList<T>({
    items,
    getItemId,
    getItemLabel,
    getItemGroup,
    renderItem,
    itemHeight = 36,
    loading,
    error,
    onRetry,
    pagination,
    emptyState: ownEmptyState,
    text: ownText,
    scrollerRef,
    listRef,
}: Shared<T> & {
    scrollerRef: RefObject<Scroller | null>
    listRef: RefObject<HTMLDivElement | null>
}) {
    'use no memo'
    const t = useMessages()
    const text = ownText ?? t.components.combobox
    const emptyState = ownEmptyState ?? t.components.combobox.empty
    const scrollRef = useRef<HTMLDivElement>(null)
    const sentinelRef = useRef<HTMLDivElement>(null)
    const requestRef = useRef(false)
    const attemptedCursor = useRef<string | null>(null)
    const [requesting, setRequesting] = useState(false)
    const [pageError, setPageError] = useState(false)
    const rows = useMemo(
        () =>
            items.flatMap((item, index): Row<T>[] => {
                const group = getItemGroup?.(item)
                return group !== undefined &&
                    (index === 0 || getItemGroup?.(items[index - 1]) !== group)
                    ? [{ group }, { item, index }]
                    : [{ item, index }]
            }),
        [items, getItemGroup],
    )
    const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        getItemKey: (index) => {
            const row = rows[index]
            return 'group' in row ? `group:${row.group}` : getItemId(row.item)
        },
        estimateSize: (index) => ('group' in rows[index] ? 28 : itemHeight),
        overscan: 8,
        directDomUpdates: true,
        directDomUpdatesMode: 'position',
    })
    useImperativeHandle(
        scrollerRef,
        () => ({
            scrollToOption: (index) =>
                virtualizer.scrollToIndex(
                    rows.findIndex((row) => 'index' in row && row.index === index),
                    { align: 'auto' },
                ),
        }),
        [virtualizer, rows],
    )
    useLayoutEffect(() => {
        virtualizer.measure()
    }, [virtualizer, itemHeight])
    useLayoutEffect(() => {
        const element = scrollRef.current
        if (element)
            element.scrollTop = Math.min(
                element.scrollTop,
                Math.max(0, element.scrollHeight - element.clientHeight),
            )
    }, [items.length])

    const loadMore = useCallback(
        async (retry = false) => {
            if (
                !pagination ||
                pagination.nextCursor === null ||
                pagination.isFetchingNextPage ||
                loading ||
                requestRef.current
            )
                return
            if (!retry && (pagination.error || attemptedCursor.current === pagination.nextCursor))
                return
            requestRef.current = true
            attemptedCursor.current = pagination.nextCursor
            setRequesting(true)
            setPageError(false)
            try {
                await pagination.fetchNextPage()
            } catch {
                setPageError(true)
            } finally {
                requestRef.current = false
                setRequesting(false)
            }
        },
        [pagination, loading],
    )

    useEffect(() => {
        const root = scrollRef.current
        const sentinel = sentinelRef.current
        if (
            !root ||
            !sentinel ||
            loading ||
            requesting ||
            pageError ||
            pagination?.error ||
            pagination?.isFetchingNextPage
        )
            return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) void loadMore()
            },
            { root, rootMargin: '0px 0px 120px 0px' },
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [items.length, pagination, loading, requesting, pageError, loadMore])

    const failure = pageError || pagination?.error
    return (
        <div
            ref={scrollRef}
            data-slot="combobox-viewport"
            className="min-h-0 overflow-auto overscroll-contain [overflow-anchor:none] [scrollbar-width:thin]"
        >
            <Primitive.List
                ref={listRef}
                aria-busy={loading || requesting || pagination?.isFetchingNextPage || undefined}
            >
                <div ref={virtualizer.containerRef} className="relative">
                    {virtualizer.getVirtualItems().map((virtual) => {
                        const row = rows[virtual.index]
                        if ('group' in row)
                            return (
                                <div
                                    key={virtual.key}
                                    ref={virtualizer.measureElement}
                                    data-index={virtual.index}
                                    aria-hidden
                                    className="absolute top-0 left-0 w-full truncate px-2.5 pt-2 pb-1 text-[11px] font-medium text-muted-foreground"
                                >
                                    {row.group}
                                </div>
                            )
                        const { item, index } = row
                        return (
                            <Primitive.Item
                                key={virtual.key}
                                ref={virtualizer.measureElement}
                                index={index}
                                data-index={virtual.index}
                                value={item}
                                aria-label={getItemLabel(item)}
                                aria-setsize={pagination?.nextCursor != null ? -1 : items.length}
                                aria-posinset={index + 1}
                                className="absolute top-0 left-0 flex w-full cursor-default items-center gap-2 px-2.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                                style={{ height: itemHeight }}
                            >
                                <span className="min-w-0 flex-1 truncate">
                                    {renderItem?.(item) ?? getItemLabel(item)}
                                </span>
                                <Primitive.ItemIndicator className="shrink-0">
                                    <Check className="size-3.5" />
                                </Primitive.ItemIndicator>
                            </Primitive.Item>
                        )
                    })}
                </div>
            </Primitive.List>
            {!!error && (
                <div
                    role="alert"
                    className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-muted-foreground"
                >
                    <span>{text.failed}</span>
                    {onRetry && (
                        <Button size="xs" variant="ghost" onClick={onRetry}>
                            {t.common.retryShort}
                        </Button>
                    )}
                </div>
            )}
            {!items.length && !loading && !error && !failure && pagination?.nextCursor == null && (
                <Primitive.Status className="px-3 py-5 text-center text-sm text-muted-foreground">
                    {emptyState}
                </Primitive.Status>
            )}
            {pagination?.nextCursor != null && <div ref={sentinelRef} className="h-px" />}
            {failure ? (
                <div
                    role="alert"
                    className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-muted-foreground"
                >
                    <span>{text.moreFailed}</span>
                    {pagination?.nextCursor != null ? (
                        <Button size="xs" variant="ghost" onClick={() => void loadMore(true)}>
                            {t.common.retryShort}
                        </Button>
                    ) : onRetry ? (
                        <Button size="xs" variant="ghost" onClick={onRetry}>
                            {t.common.retryShort}
                        </Button>
                    ) : null}
                </div>
            ) : loading || requesting || pagination?.isFetchingNextPage ? (
                <div className="flex justify-center py-3">
                    <Spinner label={text.loading} />
                </div>
            ) : null}
        </div>
    )
}

export function Combobox<T>({ value, onValueChange, ...props }: ComboboxProps<T>) {
    return <Picker {...props} selection={{ multiple: false, value, onValueChange }} />
}
export function MultiCombobox<T>({ value, onValueChange, ...props }: MultiComboboxProps<T>) {
    return <Picker {...props} selection={{ multiple: true, value, onValueChange }} />
}

function Picker<T>({ selection, ...props }: Shared<T> & { selection: Selection<T> }) {
    const {
        items,
        getItemId,
        getItemLabel,
        getItemGroup,
        label,
        placeholder: ownPlaceholder,
        searchPlaceholder: ownSearchPlaceholder,
        searchable = true,
        filter,
        disabled,
        required,
        clearable = false,
        name,
        id,
        className,
        popupClassName,
        renderValue,
        triggerClassName,
        indicator = true,
        side = 'bottom',
        sideOffset = 4,
        actions,
        header,
    } = props
    const t = useMessages()
    const placeholder = ownPlaceholder ?? t.components.picker.placeholder
    const searchPlaceholder = ownSearchPlaceholder ?? t.common.search
    const [internalSearch, setInternalSearch] = useState('')
    const [open, setOpen] = useState(false)
    const search = searchable ? (props.search ?? internalSearch) : ''
    const scrollerRef = useRef<Scroller | null>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const filtered = useMemo(
        () => groupItems(filterItems(items, search, getItemLabel, filter), getItemGroup),
        [items, search, getItemLabel, getItemGroup, filter],
    )
    const value = selection.multiple ? null : selection.value
    const knownItems = useMemo(() => {
        const chosen = selection.multiple
            ? selection.value
            : selection.value === null
              ? []
              : [selection.value]
        const missing = chosen.filter(
            (c) => !items.some((item) => getItemId(item) === getItemId(c)),
        )
        return missing.length ? [...items, ...missing] : items
    }, [items, selection.multiple, selection.value, getItemId])
    const showClear = clearable && value !== null
    const setSearch = (next: string) => {
        if (props.search === undefined) setInternalSearch(next)
        props.onSearchChange?.(next)
    }

    return (
        <Primitive.Root<T, boolean>
            virtualized
            multiple={selection.multiple}
            items={knownItems}
            filteredItems={filtered}
            value={selection.value}
            onValueChange={(next) => {
                if (selection.multiple) selection.onValueChange(next as T[])
                else selection.onValueChange(next as T | null)
            }}
            itemToStringLabel={getItemLabel}
            itemToStringValue={getItemId}
            isItemEqualToValue={(item, selected) => getItemId(item) === getItemId(selected)}
            inputValue={search}
            onInputValueChange={(next, details) => {
                if (details.reason === 'input-change' || details.reason === 'input-clear')
                    setSearch(next)
            }}
            open={open}
            onOpenChange={(next) => {
                setOpen(next)
                if (!next) setSearch('')
                props.onOpenChange?.(next)
            }}
            onItemHighlighted={(item, { index, reason }) => {
                if (item !== undefined && index >= 0 && reason !== 'pointer')
                    queueMicrotask(() => scrollerRef.current?.scrollToOption(index))
            }}
            disabled={disabled}
            required={required}
            name={name}
        >
            <div className={cn('relative flex min-w-0 items-center', className)}>
                <Primitive.Trigger
                    id={id}
                    aria-label={label}
                    data-slot="combobox-trigger"
                    className={cn(
                        'flex h-8 w-full min-w-0 items-center justify-between gap-2 border border-input bg-transparent px-2.5 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30',
                        showClear && 'pr-10',
                        triggerClassName,
                    )}
                >
                    {renderValue && !selection.multiple ? (
                        renderValue(value)
                    ) : (
                        <span className={cn('truncate', value === null && 'text-muted-foreground')}>
                            {value === null ? placeholder : getItemLabel(value)}
                        </span>
                    )}
                    {indicator && (
                        <ChevronsUpDown
                            aria-hidden="true"
                            className="size-3.5 shrink-0 text-muted-foreground"
                        />
                    )}
                </Primitive.Trigger>
                {showClear && (
                    <Button
                        aria-label={t.components.picker.clear(label)}
                        variant="ghost"
                        size="icon-xs"
                        className="absolute right-2"
                        disabled={disabled}
                        onClick={() => !selection.multiple && selection.onValueChange(null)}
                    >
                        <X />
                    </Button>
                )}
            </div>
            <Primitive.Portal>
                <Primitive.Positioner
                    side={side}
                    sideOffset={sideOffset}
                    align="start"
                    className="isolate z-50 outline-none"
                >
                    <Primitive.Popup
                        initialFocus={searchable ? undefined : listRef}
                        className={cn(
                            'flex max-h-[min(360px,var(--available-height))] w-(--anchor-width) min-w-[min(240px,var(--available-width))] max-w-(--available-width) flex-col overflow-hidden bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none',
                            popupClassName,
                        )}
                    >
                        {searchable && (
                            <div className="flex shrink-0 items-center gap-2 px-2.5 py-1">
                                <Search
                                    aria-hidden="true"
                                    className="size-3.5 text-muted-foreground"
                                />
                                <Primitive.Input
                                    aria-label={t.components.picker.search(label)}
                                    placeholder={searchPlaceholder}
                                    className="h-8 w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                                />
                            </div>
                        )}
                        {header}
                        <OptionList
                            key={JSON.stringify([props.resetKey, search])}
                            {...props}
                            items={filtered}
                            scrollerRef={scrollerRef}
                            listRef={listRef}
                        />
                        {!!actions?.length && (
                            <div className="shrink-0 border-t border-border/50 pt-1">
                                {actions.map((action) => (
                                    <Button
                                        key={action.label}
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start"
                                        onClick={() => {
                                            setOpen(false)
                                            setSearch('')
                                            action.onClick()
                                        }}
                                    >
                                        {action.icon}
                                        {action.label}
                                        {action.detail && (
                                            <span className="ml-auto tabular-nums text-muted-foreground">
                                                {action.detail}
                                            </span>
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </Primitive.Popup>
                </Primitive.Positioner>
            </Primitive.Portal>
        </Primitive.Root>
    )
}
