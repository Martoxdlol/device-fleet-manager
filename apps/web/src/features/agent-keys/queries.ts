import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listKeys, type AgentKey } from '@fleet/client'
import {
    createKeyMutation,
    deleteKeyMutation,
    listKeysInfiniteOptions,
    listKeysInfiniteQueryKey,
    renameKeyMutation,
} from '@fleet/client/react-query'
import { useAuth } from '../../auth/auth-context'
import { useComboboxData } from '../../components/combobox'
import { matchesSearch } from '../../components/combobox/model'
import { nextCursor } from '../../lib/api/pagination'

export function useAgentKeys(orgId: string) {
    const { api } = useAuth()
    return useInfiniteQuery({
        ...listKeysInfiniteOptions({ client: api, path: { org_id: orgId } }),
        initialPageParam: { path: { org_id: orgId } },
        getNextPageParam: nextCursor,
    })
}

function useKeysRefresh(orgId: string) {
    const { api } = useAuth()
    const cache = useQueryClient()
    return () =>
        cache.invalidateQueries({
            queryKey: listKeysInfiniteQueryKey({ client: api, path: { org_id: orgId } }),
        })
}

export function useCreateKey(orgId: string) {
    const { api } = useAuth()
    const refresh = useKeysRefresh(orgId)
    return useMutation({
        ...createKeyMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export function useRenameKey(orgId: string) {
    const { api } = useAuth()
    const refresh = useKeysRefresh(orgId)
    return useMutation({
        ...renameKeyMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export function useDeleteKey(orgId: string) {
    const { api } = useAuth()
    const refresh = useKeysRefresh(orgId)
    return useMutation({
        ...deleteKeyMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export function useKeyOptions(orgId: string) {
    const { api } = useAuth()
    return useComboboxData<AgentKey>({
        queryKey: [
            ...listKeysInfiniteQueryKey({ client: api, path: { org_id: orgId } }),
            'combobox',
        ],
        getItemId: (key) => key.id,
        getItemLabel: (key) => key.name,
        fetchPage: async ({ search, cursor, signal }) => {
            const { data } = await listKeys({
                client: api,
                path: { org_id: orgId },
                query: { cursor: cursor ?? undefined },
                signal,
                throwOnError: true,
            })
            return {
                rows: data.items.filter((key) => !search || matchesSearch(key.name, search)),
                nextCursor: data.next_cursor ?? null,
            }
        },
    })
}
