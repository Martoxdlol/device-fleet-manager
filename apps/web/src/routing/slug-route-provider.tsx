import { useEffect, type ReactNode } from 'react'
import { Outlet, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getFleetOptions, getOrgOptions } from '@fleet/client/react-query'
import { useAccount, useAuth } from '../auth/auth-context'
import { PageLayout } from '../components/layout/page-layout'
import { PageContent } from '../core/scaffold/scaffold'
import { LoadingState, QueryError } from '../components/feedback/query-feedback'
import { EmptyState } from '../core/ui/primitives'
import { errorMessage, isApiError } from '../lib/api/errors'
import { RouteScopeContext } from './route-context'
import { routeResolutionOptions } from './resolution'
import { useMessages } from '../i18n/provider'

function RouteFrame({ children }: { children: ReactNode }) {
    const t = useMessages().app.route
    return (
        <PageLayout title={t.title} back={{ href: '/', label: t.back }}>
            <PageContent>{children}</PageContent>
        </PageLayout>
    )
}

export function SlugRouteProvider() {
    const { orgSlug = '', fleetSlug } = useParams()
    const t = useMessages()
    const { api, setLastOrg } = useAuth()
    const { lastOrgSlug } = useAccount()
    const cache = useQueryClient()
    const resolved = useQuery(
        routeResolutionOptions(api, cache, {
            org: orgSlug,
            ...(fleetSlug ? { fleet: fleetSlug } : {}),
        }),
    )
    const orgId = resolved.data?.org_id
    const fleetId = fleetSlug ? resolved.data?.fleet_id : null
    const org = useQuery({
        ...getOrgOptions({ client: api, path: { org_id: orgId ?? '' } }),
        enabled: !!orgId,
    })
    const fleet = useQuery({
        ...getFleetOptions({ client: api, path: { fleet_id: fleetId ?? '' } }),
        enabled: !!fleetId,
    })
    const opened = org.data?.slug
    useEffect(() => {
        if (opened) setLastOrg(opened)
    }, [opened, setLastOrg])
    const orgMissing =
        !fleetSlug && isApiError(resolved.error) && resolved.error.error === 'not_found'
    useEffect(() => {
        if (orgMissing && lastOrgSlug?.toLowerCase() === orgSlug.toLowerCase()) setLastOrg(null)
    }, [orgMissing, lastOrgSlug, orgSlug, setLastOrg])
    const failed = resolved.error ?? org.error ?? fleet.error
    const retry = () => {
        if (resolved.isError) void resolved.refetch()
        if (org.isError) void org.refetch()
        if (fleet.isError) void fleet.refetch()
    }
    if (!org.data || (fleetSlug && !fleet.data))
        return (
            <RouteFrame>
                {isApiError(failed) && failed.error === 'not_found' ? (
                    <EmptyState surface>
                        <h2>{errorMessage(failed, t)}</h2>
                    </EmptyState>
                ) : failed ? (
                    <QueryError error={failed} retry={retry} />
                ) : (
                    <LoadingState label={t.app.route.opening} />
                )}
            </RouteFrame>
        )
    return (
        <RouteScopeContext
            value={{ org: org.data, fleet: fleetSlug ? (fleet.data ?? null) : null }}
        >
            <Outlet />
        </RouteScopeContext>
    )
}
