import {
    keepPreviousData,
    useInfiniteQuery,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query'
import { listMembers, type Member } from '@fleet/client'
import {
    listMembersInfiniteOptions,
    listMembersInfiniteQueryKey,
    removeMemberMutation,
    updateMemberMutation,
} from '@fleet/client/react-query'
import { useAuth } from '../../auth/auth-context'
import { useComboboxData } from '../../components/combobox'
import { nextCursor } from '../../lib/api/pagination'

export function useMemberList(orgId: string, search: string) {
    const { api } = useAuth()
    return useInfiniteQuery({
        ...listMembersInfiniteOptions({
            client: api,
            path: { org_id: orgId },
            ...(search ? { query: { q: search } } : {}),
        }),
        initialPageParam: { path: { org_id: orgId } },
        getNextPageParam: nextCursor,
        placeholderData: keepPreviousData,
    })
}

function useMemberListRefresh(orgId: string) {
    const { api } = useAuth()
    const cache = useQueryClient()
    return () =>
        cache.invalidateQueries({
            queryKey: listMembersInfiniteQueryKey({ client: api, path: { org_id: orgId } }),
        })
}

export function useUpdateMember(orgId: string) {
    const { api } = useAuth()
    const refresh = useMemberListRefresh(orgId)
    return useMutation({
        ...updateMemberMutation({ client: api }),
        onSettled: () => void refresh(),
    })
}

export function useRemoveMember(orgId: string) {
    const { api } = useAuth()
    const refresh = useMemberListRefresh(orgId)
    return useMutation({
        ...removeMemberMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export function useMemberOptions(orgId: string) {
    const { api } = useAuth()
    return useComboboxData<Member>({
        queryKey: [
            ...listMembersInfiniteQueryKey({ client: api, path: { org_id: orgId } }),
            'combobox',
        ],
        getItemId: (member) => member.user_id,
        getItemLabel: (member) => member.name || member.email,
        fetchPage: async ({ search, cursor, signal }) => {
            const { data } = await listMembers({
                client: api,
                path: { org_id: orgId },
                query: { cursor: cursor ?? undefined, q: search || undefined },
                signal,
                throwOnError: true,
            })
            return { rows: data.items, nextCursor: data.next_cursor ?? null }
        },
    })
}
