import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listFleets, listMembers, type MyOrganization, type VisibleFleet } from '@fleet/client'
import {
    createFleetMutation,
    createGrantMutation,
    deleteFleetMutation,
    deleteGrantMutation,
    listFleetsInfiniteOptions,
    listFleetsInfiniteQueryKey,
    listGrantsInfiniteOptions,
    listGrantsInfiniteQueryKey,
    listKeysInfiniteQueryKey,
    resolveQueryKey,
    updateFleetMutation,
    updateGrantMutation,
} from '@fleet/client/react-query'
import { useAuth } from '../../auth/auth-context'
import { useComboboxData } from '../../components/combobox'
import { matchesSearch } from '../../components/combobox/model'
import { nextCursor } from '../../lib/api/pagination'
import { rememberRoute } from '../../routing/resolution'
import { fetchGroupPage } from '../groups/queries'

export function useFleets(orgId: string) {
    const { api } = useAuth()
    return useInfiniteQuery({
        ...listFleetsInfiniteOptions({ client: api, path: { org_id: orgId } }),
        initialPageParam: { path: { org_id: orgId } },
        getNextPageParam: nextCursor,
    })
}

function useFleetsRefresh(orgId: string) {
    const { api } = useAuth()
    const cache = useQueryClient()
    return () =>
        Promise.all([
            cache.invalidateQueries({
                queryKey: listFleetsInfiniteQueryKey({ client: api, path: { org_id: orgId } }),
            }),
            cache.invalidateQueries({
                queryKey: listKeysInfiniteQueryKey({ client: api, path: { org_id: orgId } }),
            }),
        ])
}

export function useCreateFleet(org: MyOrganization) {
    const { api } = useAuth()
    const cache = useQueryClient()
    const refresh = useFleetsRefresh(org.id)
    return useMutation({
        ...createFleetMutation({ client: api }),
        onSuccess: (created) => {
            void refresh()
            rememberRoute(api, cache, org, { ...created, access: 'admin' })
        },
    })
}

export function useUpdateFleet(org: MyOrganization, fleet: VisibleFleet) {
    const { api } = useAuth()
    const cache = useQueryClient()
    const refresh = useFleetsRefresh(org.id)
    return useMutation({
        ...updateFleetMutation({ client: api }),
        onSuccess: (updated) => {
            if (updated.slug !== fleet.slug)
                cache.removeQueries({
                    queryKey: resolveQueryKey({
                        client: api,
                        query: { org: org.slug, fleet: fleet.slug },
                    }),
                })
            void refresh()
            rememberRoute(api, cache, org, { ...updated, access: fleet.access })
        },
    })
}

export function useDeleteFleet(org: MyOrganization, fleet: VisibleFleet) {
    const { api } = useAuth()
    const cache = useQueryClient()
    const refresh = useFleetsRefresh(org.id)
    return useMutation({
        ...deleteFleetMutation({ client: api }),
        onSuccess: () => {
            cache.removeQueries({
                queryKey: resolveQueryKey({
                    client: api,
                    query: { org: org.slug, fleet: fleet.slug },
                }),
            })
            void refresh()
        },
    })
}

export function useFleetOptions(orgId: string) {
    const { api } = useAuth()
    return useComboboxData<VisibleFleet>({
        queryKey: [
            ...listFleetsInfiniteQueryKey({ client: api, path: { org_id: orgId } }),
            'combobox',
        ],
        getItemId: (fleet) => fleet.id,
        getItemLabel: (fleet) => fleet.name,
        fetchPage: async ({ search, cursor, signal }) => {
            const { data } = await listFleets({
                client: api,
                path: { org_id: orgId },
                query: { cursor: cursor ?? undefined },
                signal,
                throwOnError: true,
            })
            return {
                rows: data.items.filter((fleet) => !search || matchesSearch(fleet.name, search)),
                nextCursor: data.next_cursor ?? null,
            }
        },
    })
}

export function useGrants(fleetId: string) {
    const { api } = useAuth()
    return useInfiniteQuery({
        ...listGrantsInfiniteOptions({ client: api, path: { fleet_id: fleetId } }),
        initialPageParam: { path: { fleet_id: fleetId } },
        getNextPageParam: nextCursor,
    })
}

function useGrantsRefresh(fleetId: string) {
    const { api } = useAuth()
    const cache = useQueryClient()
    return () =>
        cache.invalidateQueries({
            queryKey: listGrantsInfiniteQueryKey({ client: api, path: { fleet_id: fleetId } }),
        })
}

export function useCreateGrant(fleetId: string) {
    const { api } = useAuth()
    const refresh = useGrantsRefresh(fleetId)
    return useMutation({
        ...createGrantMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export function useUpdateGrant(fleetId: string) {
    const { api } = useAuth()
    const refresh = useGrantsRefresh(fleetId)
    return useMutation({
        ...updateGrantMutation({ client: api }),
        onSettled: () => void refresh(),
    })
}

export function useDeleteGrant(fleetId: string) {
    const { api } = useAuth()
    const refresh = useGrantsRefresh(fleetId)
    return useMutation({
        ...deleteGrantMutation({ client: api }),
        onSuccess: () => void refresh(),
    })
}

export type Subject =
    | { kind: 'user'; id: string; name: string; email: string }
    | { kind: 'group'; id: string; name: string }

type SubjectCursor = { members: string | null | false; groups: string | null | false }

export function useSubjectOptions(orgId: string) {
    const { api } = useAuth()
    return useComboboxData<Subject>({
        queryKey: ['grantSubjects', orgId],
        getItemId: (subject) => `${subject.kind}:${subject.id}`,
        getItemLabel: (subject) =>
            subject.kind === 'user' ? subject.name.trim() || subject.email : subject.name,
        fetchPage: async ({ search, cursor, signal }) => {
            const state: SubjectCursor = cursor
                ? (JSON.parse(cursor) as SubjectCursor)
                : { members: null, groups: null }
            const [members, groups] = await Promise.all([
                state.members === false
                    ? null
                    : listMembers({
                          client: api,
                          path: { org_id: orgId },
                          query: { cursor: state.members ?? undefined, q: search || undefined },
                          signal,
                          throwOnError: true,
                      }).then(({ data }) => data),
                state.groups === false
                    ? null
                    : fetchGroupPage(api, orgId, state.groups, search, signal),
            ])
            const next: SubjectCursor = {
                members: members?.next_cursor ?? false,
                groups: groups?.nextCursor ?? false,
            }
            return {
                rows: [
                    ...(members?.items ?? []).map((member): Subject => ({
                        kind: 'user',
                        id: member.user_id,
                        name: member.name,
                        email: member.email,
                    })),
                    ...(groups?.rows ?? []).map((group): Subject => ({
                        kind: 'group',
                        id: group.id,
                        name: group.name,
                    })),
                ],
                nextCursor:
                    next.members === false && next.groups === false ? null : JSON.stringify(next),
            }
        },
    })
}
