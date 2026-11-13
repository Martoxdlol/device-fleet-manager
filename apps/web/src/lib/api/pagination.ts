import { useMemo } from 'react'
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'

export function nextCursor(page: { next_cursor?: string | null }) {
    return page.next_cursor ?? undefined
}

type Listing<T> = InfiniteData<{ items: T[]; next_cursor?: string | null }, unknown>

export function seedListItem<T extends { id: string }>(
    cache: QueryClient,
    queryKey: QueryKey,
    item: T,
) {
    cache.setQueryData<Listing<T>>(queryKey, (data) => {
        if (!data) return data
        if (data.pages.some((page) => page.items.some((row) => row.id === item.id)))
            return {
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: page.items.map((row) => (row.id === item.id ? item : row)),
                })),
            }
        const last = data.pages.at(-1)
        if (!last || last.next_cursor) return data
        return {
            ...data,
            pages: [...data.pages.slice(0, -1), { ...last, items: [...last.items, item] }],
        }
    })
}

export function dropListItem(cache: QueryClient, queryKey: QueryKey, id: string) {
    cache.setQueryData<Listing<{ id: string }>>(
        queryKey,
        (data) =>
            data && {
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: page.items.filter((row) => row.id !== id),
                })),
            },
    )
}

type Paged<T> = { items: T[]; next_cursor?: string | null }

export function usePagedList<T>(query: {
    data?: { pages: Paged<T>[] }
    fetchNextPage: () => Promise<unknown>
    isFetchingNextPage: boolean
    isFetchNextPageError: boolean
    error: unknown
}) {
    const { data, fetchNextPage, isFetchingNextPage, isFetchNextPageError, error } = query
    const rows = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data])
    const pagination = useMemo(
        () => ({
            nextCursor: data?.pages.at(-1)?.next_cursor ?? null,
            fetchNextPage,
            isFetchingNextPage,
            error: isFetchNextPageError ? error : undefined,
        }),
        [data, fetchNextPage, isFetchingNextPage, isFetchNextPageError, error],
    )
    return { rows, pagination }
}
