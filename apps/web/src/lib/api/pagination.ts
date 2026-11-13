import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'

/** Generated infinite-query options leave the API's cursor policy to the consumer. */
export function nextCursor(page: { next_cursor?: string | null }) {
    return page.next_cursor ?? undefined
}

type Listing<T> = InfiniteData<{ items: T[]; next_cursor?: string | null }, unknown>

/**
 * Writes a resource the server answered with into its cached list: in place when it is listed,
 * otherwise after the last row, since lists run in creation order. A list with pages still to
 * load leaves a new resource for the page that brings it.
 */
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

/** Takes a deleted resource out of its cached list. */
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
