import { QueryClient } from '@tanstack/react-query'
import { retryQuery } from './errors'

export function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { staleTime: 30_000, retry: retryQuery },
            mutations: { retry: false },
        },
    })
}
