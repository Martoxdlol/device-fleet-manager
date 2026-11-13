import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Client } from '@fleet/client'
import { meOptions } from '@fleet/client/react-query'
import { useAuthStore } from './auth-context'
import type { Account } from './store'

export function SessionGuard({
    api,
    index,
    account,
}: {
    api: Client
    index: number
    account: Account
}) {
    const store = useAuthStore()
    const query = useQuery({
        ...meOptions({ client: api }),
        initialData: account.user,
        initialDataUpdatedAt: 0,
        retry: false,
    })
    const confirmed = query.isSuccess && query.isFetchedAfterMount
    const user = query.data
    useEffect(() => {
        if (!confirmed) return
        if (JSON.stringify(user) !== JSON.stringify(account.user))
            store.updateSlot(index, { ...account, user })
    }, [store, confirmed, user, account, index])
    return null
}
