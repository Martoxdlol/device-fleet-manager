import {
    resolve,
    type Client,
    type MyOrganization,
    type Resolved,
    type VisibleFleet,
} from '@fleet/client'
import {
    getFleetQueryKey,
    getOrgQueryKey,
    resolveOptions,
    resolveQueryKey,
} from '@fleet/client/react-query'
import type { QueryClient } from '@tanstack/react-query'

type Slugs = { org: string; fleet?: string }

export function rememberRoute(
    api: Client,
    cache: QueryClient,
    org: MyOrganization,
    fleet?: VisibleFleet,
) {
    const known: Resolved = { org_id: org.id, fleet_id: null }
    cache.setQueryData(resolveQueryKey({ client: api, query: { org: org.slug } }), known)
    cache.setQueryData(getOrgQueryKey({ client: api, path: { org_id: org.id } }), org)
    if (!fleet) return
    cache.setQueryData(
        resolveQueryKey({ client: api, query: { org: org.slug, fleet: fleet.slug } }),
        { org_id: org.id, fleet_id: fleet.id },
    )
    cache.setQueryData(getFleetQueryKey({ client: api, path: { fleet_id: fleet.id } }), fleet)
}

export function routeResolutionOptions(api: Client, cache: QueryClient, query: Slugs) {
    return {
        ...resolveOptions({ client: api, query }),
        staleTime: Infinity,
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
            const { data } = await resolve({ client: api, query, signal, throwOnError: true })
            if (query.fleet)
                cache.setQueryData(resolveQueryKey({ client: api, query: { org: query.org } }), {
                    org_id: data.org_id,
                    fleet_id: null,
                })
            return data
        },
    }
}
