import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listGroups, type Client, type Group } from '@fleet/client'
import {
    addGroupMembersMutation,
    createGroupMutation,
    deleteGroupMutation,
    listGroupMembersInfiniteOptions,
    listGroupMembersInfiniteQueryKey,
    listGroupsInfiniteOptions,
    listGroupsInfiniteQueryKey,
    removeGroupMemberMutation,
    renameGroupMutation,
} from '@fleet/client/react-query'
import { useAuth } from '../../auth/auth-context'
import { matchesSearch } from '../../components/combobox/model'
import { nextCursor } from '../../lib/api/pagination'

export function useGroups(orgId: string) {
    const { api } = useAuth()
    return useInfiniteQuery({
        ...listGroupsInfiniteOptions({ client: api, path: { org_id: orgId } }),
        initialPageParam: { path: { org_id: orgId } },
        getNextPageParam: nextCursor,
    })
}

function useGroupsRefresh(orgId: string) {
    const { api } = useAuth()
    const cache = useQueryClient()
    return () =>
        cache.invalidateQueries({
            queryKey: listGroupsInfiniteQueryKey({ client: api, path: { org_id: orgId } }),
        })
}

export function useCreateGroup(orgId: string) {
    const { api } = useAuth()
    const refresh = useGroupsRefresh(orgId)
    return useMutation({
        ...createGroupMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export function useRenameGroup(orgId: string) {
    const { api } = useAuth()
    const refresh = useGroupsRefresh(orgId)
    return useMutation({
        ...renameGroupMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export function useDeleteGroup(orgId: string) {
    const { api } = useAuth()
    const refresh = useGroupsRefresh(orgId)
    return useMutation({
        ...deleteGroupMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export function useGroupMembers(orgId: string, groupId: string) {
    const { api } = useAuth()
    const path = { org_id: orgId, group_id: groupId }
    return useInfiniteQuery({
        ...listGroupMembersInfiniteOptions({ client: api, path }),
        initialPageParam: { path },
        getNextPageParam: nextCursor,
    })
}

function useGroupMembersRefresh(orgId: string, groupId: string) {
    const { api } = useAuth()
    const cache = useQueryClient()
    const refreshGroups = useGroupsRefresh(orgId)
    return () =>
        Promise.all([
            cache.invalidateQueries({
                queryKey: listGroupMembersInfiniteQueryKey({
                    client: api,
                    path: { org_id: orgId, group_id: groupId },
                }),
            }),
            refreshGroups(),
        ])
}

export function useAddGroupMembers(orgId: string, groupId: string) {
    const { api } = useAuth()
    const refresh = useGroupMembersRefresh(orgId, groupId)
    return useMutation({
        ...addGroupMembersMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export function useRemoveGroupMember(orgId: string, groupId: string) {
    const { api } = useAuth()
    const refresh = useGroupMembersRefresh(orgId, groupId)
    return useMutation({
        ...removeGroupMemberMutation({ client: api }),
        onSettled: () => void refresh(),
    })
}

export async function fetchGroupPage(
    api: Client,
    orgId: string,
    cursor: string | null,
    search: string,
    signal: AbortSignal,
) {
    const { data } = await listGroups({
        client: api,
        path: { org_id: orgId },
        query: { cursor: cursor ?? undefined },
        signal,
        throwOnError: true,
    })
    return {
        rows: data.items.filter((group: Group) => !search || matchesSearch(group.name, search)),
        nextCursor: data.next_cursor ?? null,
    }
}
