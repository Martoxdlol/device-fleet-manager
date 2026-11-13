import {
    useInfiniteQuery,
    useMutation,
    useQueryClient,
    type QueryClient,
} from '@tanstack/react-query'
import type { Client, MyOrganization, Organization } from '@fleet/client'
import {
    createOrgMutation,
    deleteOrgMutation,
    listOrgsInfiniteOptions,
    listOrgsInfiniteQueryKey,
    removeMemberMutation,
    resolveQueryKey,
    updateOrgMutation,
} from '@fleet/client/react-query'
import { useAccount, useAuth } from '../../auth/auth-context'
import { nextCursor } from '../../lib/api/pagination'
import { rememberRoute } from '../../routing/resolution'

export function useOrganizations() {
    const { api } = useAuth()
    return useInfiniteQuery({
        ...listOrgsInfiniteOptions({ client: api }),
        initialPageParam: {},
        getNextPageParam: nextCursor,
    })
}

export function useCreateOrganization() {
    const { api } = useAuth()
    const cache = useQueryClient()
    return useMutation({
        ...createOrgMutation({ client: api }),
        onSuccess: (created) => {
            void cache.invalidateQueries({ queryKey: listOrgsInfiniteQueryKey({ client: api }) })
            rememberRoute(api, cache, { ...created, role: 'owner' })
        },
    })
}

function rememberOrganization(
    api: Client,
    cache: QueryClient,
    previous: MyOrganization,
    updated: Organization,
) {
    if (updated.slug !== previous.slug)
        cache.removeQueries({
            queryKey: resolveQueryKey({ client: api, query: { org: previous.slug } }),
        })
    void cache.invalidateQueries({ queryKey: listOrgsInfiniteQueryKey({ client: api }) })
    rememberRoute(api, cache, { ...updated, role: previous.role })
}

export function useUpdateOrganization(org: MyOrganization) {
    const { api } = useAuth()
    const cache = useQueryClient()
    return useMutation({
        ...updateOrgMutation({ client: api }),
        onSuccess: (updated) => rememberOrganization(api, cache, org, updated),
    })
}

function useForgetOrganization() {
    const { api, setLastOrg } = useAuth()
    const { lastOrgSlug } = useAccount()
    const cache = useQueryClient()
    return (slug: string) => {
        cache.removeQueries({ queryKey: resolveQueryKey({ client: api, query: { org: slug } }) })
        void cache.invalidateQueries({ queryKey: listOrgsInfiniteQueryKey({ client: api }) })
        if (lastOrgSlug?.toLowerCase() === slug.toLowerCase()) setLastOrg(null)
    }
}

export function useDeleteOrganization(org: { slug: string }) {
    const { api } = useAuth()
    const forget = useForgetOrganization()
    return useMutation({
        ...deleteOrgMutation({ client: api }),
        onSuccess: () => forget(org.slug),
    })
}

export function useLeaveOrganization(org: { slug: string }) {
    const { api } = useAuth()
    const forget = useForgetOrganization()
    return useMutation({
        ...removeMemberMutation({ client: api }),
        onSuccess: () => forget(org.slug),
    })
}
