import { useQuery } from '@tanstack/react-query'
import type { Client } from '@fleet/client'
import { instanceOptions } from '@fleet/client/react-query'
import { useAccount, useAuth } from './auth-context'

export function instanceQuery(api: Client) {
    return { ...instanceOptions({ client: api }), staleTime: Infinity }
}

export function useCanCreateOrganization() {
    const { api } = useAuth()
    const { user } = useAccount()
    const instance = useQuery(instanceQuery(api))
    return user.instance_admin || instance.data?.signup === 'open'
}
