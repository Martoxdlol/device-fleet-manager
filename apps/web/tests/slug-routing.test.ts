import { expect, test } from 'bun:test'
import { createClient, type MyOrganization, type VisibleFleet } from '@fleet/client'
import { getFleetQueryKey, getOrgQueryKey, resolveQueryKey } from '@fleet/client/react-query'
import { createQueryClient } from '../src/lib/api/query-client'
import { rememberRoute, routeResolutionOptions } from '../src/routing/resolution'

const org: MyOrganization = {
    id: '01900000-0000-7000-8000-000000000001',
    slug: 'acme',
    name: 'Acme',
    role: 'owner',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
}
const fleet: VisibleFleet = {
    id: '01900000-0000-7000-8000-000000000002',
    org_id: org.id,
    slug: 'laptops',
    name: 'Laptops',
    agent_key_id: '01900000-0000-7000-8000-000000000003',
    access: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
}

test('a cold fleet route resolves once and caches its organization scope too', async () => {
    const requests: Request[] = []
    const api = createClient({
        baseUrl: 'https://fleet.test',
        auth: () => 'account-token',
        fetch: (async (request: Request) => {
            requests.push(request)
            return Response.json({ org_id: org.id, fleet_id: fleet.id })
        }) as typeof fetch,
    })
    const cache = createQueryClient()
    const query = { org: org.slug, fleet: fleet.slug }
    expect(await cache.fetchQuery(routeResolutionOptions(api, cache, query))).toEqual({
        org_id: org.id,
        fleet_id: fleet.id,
    })
    const url = new URL(requests[0]!.url)
    expect(url.pathname).toBe('/api/v1/resolve')
    expect(Object.fromEntries(url.searchParams)).toEqual(query)
    expect(requests[0]!.headers.get('Authorization')).toBe('Bearer account-token')
    const parent = await cache.fetchQuery(routeResolutionOptions(api, cache, { org: org.slug }))
    expect(parent).toEqual({ org_id: org.id, fleet_id: null })
    expect(requests).toHaveLength(1)
    cache.clear()
})

test('known navigation seeds the route and its records without a request', async () => {
    const api = createClient({
        baseUrl: 'https://fleet.test',
        fetch: (async (_request: Request): Promise<Response> => {
            throw new Error('Known navigation must not resolve again')
        }) as typeof fetch,
    })
    const cache = createQueryClient()
    rememberRoute(api, cache, org, fleet)
    const resolved = await cache.fetchQuery(
        routeResolutionOptions(api, cache, { org: 'acme', fleet: 'laptops' }),
    )
    expect(resolved).toEqual({ org_id: org.id, fleet_id: fleet.id })
    expect(cache.getQueryData(getOrgQueryKey({ client: api, path: { org_id: org.id } }))).toEqual(
        org,
    )
    expect(
        cache.getQueryData(getFleetQueryKey({ client: api, path: { fleet_id: fleet.id } })),
    ).toEqual(fleet)
    cache.clear()
})

test('an unknown slug fails without caching a guess', async () => {
    let calls = 0
    const error = { error: 'not_found', message: 'Fleet not found' }
    const api = createClient({
        baseUrl: 'https://fleet.test',
        fetch: (async (_request: Request) => {
            calls++
            return Response.json(error, { status: 404 })
        }) as typeof fetch,
    })
    const cache = createQueryClient()
    const query = { org: 'acme', fleet: 'missing' }
    await expect(cache.fetchQuery(routeResolutionOptions(api, cache, query))).rejects.toEqual(error)
    expect(calls).toBe(1)
    expect(cache.getQueryData(resolveQueryKey({ client: api, query }))).toBeUndefined()
    expect(
        cache.getQueryData(resolveQueryKey({ client: api, query: { org: 'acme' } })),
    ).toBeUndefined()
    cache.clear()
})
