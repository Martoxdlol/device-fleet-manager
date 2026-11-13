import { createContext, useContext } from 'react'
import type { MyOrganization, VisibleFleet } from '@fleet/client'

export interface RouteScope {
    org: MyOrganization
    fleet: VisibleFleet | null
}

export const RouteScopeContext = createContext<RouteScope | null>(null)

export function useRouteScope() {
    const scope = useContext(RouteScopeContext)
    if (!scope) throw new Error('useRouteScope requires SlugRouteProvider')
    return scope
}

export function useFleetScope() {
    const { org, fleet } = useRouteScope()
    if (!fleet) throw new Error('useFleetScope requires a fleet route')
    return { org, fleet }
}
