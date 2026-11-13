import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    createInvitationMutation,
    listInvitationsInfiniteOptions,
    listInvitationsInfiniteQueryKey,
    revokeInvitationMutation,
} from '@fleet/client/react-query'
import { useAuth } from '../../auth/auth-context'
import { nextCursor } from '../../lib/api/pagination'

export function useInvitations(orgId: string) {
    const { api } = useAuth()
    return useInfiniteQuery({
        ...listInvitationsInfiniteOptions({ client: api, path: { org_id: orgId } }),
        initialPageParam: { path: { org_id: orgId } },
        getNextPageParam: nextCursor,
    })
}

function useInvitationsRefresh(orgId: string) {
    const { api } = useAuth()
    const cache = useQueryClient()
    return () =>
        cache.invalidateQueries({
            queryKey: listInvitationsInfiniteQueryKey({ client: api, path: { org_id: orgId } }),
        })
}

export function useInvite(orgId: string) {
    const { api } = useAuth()
    const refresh = useInvitationsRefresh(orgId)
    return useMutation({
        ...createInvitationMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export function useRevokeInvitation(orgId: string) {
    const { api } = useAuth()
    const refresh = useInvitationsRefresh(orgId)
    return useMutation({
        ...revokeInvitationMutation({ client: api }),
        onSettled: () => void refresh(),
    })
}
