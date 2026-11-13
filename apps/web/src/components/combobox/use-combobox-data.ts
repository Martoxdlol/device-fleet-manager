import { useEffect, useMemo, useState } from 'react'
import { hashKey, useInfiniteQuery } from '@tanstack/react-query'
import type { CursorPagination } from '../data-table/types'
import { filterItems } from './model'
import type { ComboboxDataOptions, CursorPage } from './types'

const EMPTY_PAGES: readonly never[] = []

export function uniqueRows<T>(
    pages: readonly { rows: readonly T[] }[],
    getRowId: (row: T) => string,
): T[] {
    const rows = new Map<string, T>()
    for (const page of pages) for (const row of page.rows) rows.set(getRowId(row), row)
    return [...rows.values()]
}

export function validateNextCursor(next: string | null, used: readonly (string | null)[]) {
    if (next !== null && used.includes(next))
        throw new Error('The server returned a repeated pagination cursor.')
    return next
}

export function useComboboxData<T>({
    queryKey,
    fetchPage,
    getItemId,
    getItemLabel,
    filter,
    debounceMs = 250,
    enabled = true,
}: ComboboxDataOptions<T>) {
    const [search, setSearch] = useState('')
    const [serverSearch, setServerSearch] = useState('')
    const scope = hashKey(queryKey)
    const [retained, setRetained] = useState<{
        scope: string
        pages: CursorPage<T>[]
    } | null>(null)

    useEffect(() => {
        const timer = setTimeout(() => setServerSearch(search), Math.max(0, debounceMs))
        return () => clearTimeout(timer)
    }, [search, debounceMs])

    const query = useInfiniteQuery({
        queryKey: [...queryKey, { comboboxSearch: serverSearch }],
        enabled,
        initialPageParam: null as string | null,
        queryFn: async ({ pageParam, signal }) => {
            const page = await fetchPage({ search: serverSearch, cursor: pageParam, signal })
            validateNextCursor(page.nextCursor, [pageParam])
            return page
        },
        getNextPageParam: (page, _pages, _lastParam, params) =>
            page.nextCursor !== null && !params.includes(page.nextCursor)
                ? page.nextCursor
                : undefined,
        placeholderData: (previous, previousQuery) =>
            previousQuery && hashKey(previousQuery.queryKey.slice(0, -1)) === scope
                ? previous
                : undefined,
    })

    if (
        query.data &&
        !query.isPlaceholderData &&
        (retained?.scope !== scope || retained.pages !== query.data.pages)
    )
        setRetained({ scope, pages: query.data.pages })

    const awaitingResults = search !== serverSearch || query.isPlaceholderData || !query.data
    const pages = query.data?.pages ?? (retained?.scope === scope ? retained.pages : EMPTY_PAGES)
    const loaded = useMemo(() => uniqueRows(pages, getItemId), [pages, getItemId])
    const items = useMemo(
        () => (awaitingResults ? filterItems(loaded, search, getItemLabel, filter) : loaded),
        [loaded, awaitingResults, search, getItemLabel, filter],
    )
    const last = query.data?.pages.at(-1)
    const cycle = last?.nextCursor != null && query.data?.pageParams.includes(last.nextCursor)
    const pagination: CursorPagination = {
        nextCursor:
            enabled && !awaitingResults && query.hasNextPage ? (last?.nextCursor ?? null) : null,
        isFetchingNextPage: query.isFetchingNextPage,
        fetchNextPage: () => query.fetchNextPage({ cancelRefetch: false, throwOnError: true }),
        error: query.isFetchNextPageError
            ? query.error
            : cycle
              ? new Error('The server returned a repeated pagination cursor.')
              : undefined,
    }

    return {
        items,
        search,
        onSearchChange: setSearch,
        filter: null,
        loading:
            enabled && (search !== serverSearch || (query.isFetching && !query.isFetchingNextPage)),
        error: query.isError && !query.isFetchNextPageError ? query.error : undefined,
        onRetry: () => {
            void query.refetch()
        },
        pagination,
        resetKey: hashKey([scope, search]),
    }
}
