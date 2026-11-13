import {
    keepPreviousData,
    useInfiniteQuery,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query'
import {
    changePasswordMutation,
    createPasswordResetMutation,
    listUsersInfiniteOptions,
    listUsersInfiniteQueryKey,
    meQueryKey,
    updateMeMutation,
    updateUserMutation,
} from '@fleet/client/react-query'
import { useAuth } from '../../auth/auth-context'
import { nextCursor } from '../../lib/api/pagination'

export function useUpdateMe() {
    const { api } = useAuth()
    const cache = useQueryClient()
    return useMutation({
        ...updateMeMutation({ client: api }),
        onSuccess: (user) => cache.setQueryData(meQueryKey({ client: api }), user),
    })
}

export function useChangePassword() {
    const { api } = useAuth()
    const cache = useQueryClient()
    return useMutation({
        ...changePasswordMutation({ client: api }),
        onSuccess: () => cache.invalidateQueries({ queryKey: meQueryKey({ client: api }) }),
    })
}

export function useUsers(search: string) {
    const { api } = useAuth()
    return useInfiniteQuery({
        ...listUsersInfiniteOptions({ client: api, ...(search ? { query: { q: search } } : {}) }),
        initialPageParam: {},
        getNextPageParam: nextCursor,
        placeholderData: keepPreviousData,
    })
}

export function useUpdateUser() {
    const { api } = useAuth()
    const cache = useQueryClient()
    return useMutation({
        ...updateUserMutation({ client: api }),
        onSettled: () =>
            Promise.all([
                cache.invalidateQueries({ queryKey: listUsersInfiniteQueryKey({ client: api }) }),
                cache.invalidateQueries({ queryKey: meQueryKey({ client: api }) }),
            ]),
    })
}

export function useCreatePasswordReset() {
    const { api } = useAuth()
    return useMutation(createPasswordResetMutation({ client: api }))
}
