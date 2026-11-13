import { expect, test } from 'bun:test'
import { me, type User } from '@fleet/client'
import { AuthStore, type Account } from '../src/auth/store'

const user = (id: string) => ({ id, email: `${id}@example.com` }) as User
const account = (token: string, id: string): Account => ({
    token,
    user: user(id),
    lastOrgSlug: null,
})
const refuse = (async (_request: Request) =>
    Response.json({ error: 'unauthenticated', message: '' }, { status: 401 })) as typeof fetch

test('a 401 ends the slot it was sent for, and not a newer sign-in in that slot', async () => {
    const store = new AuthStore('https://fleet.test')
    store.updateSlot(0, account('old-token', 'ada'))
    const stale = store.client(0, 'old-token')
    store.updateSlot(0, account('new-token', 'ada'))
    await me({ client: stale, fetch: refuse })
    expect(store.get().slots[0]?.token).toBe('new-token')

    await me({ client: store.client(0, 'new-token'), fetch: refuse })
    expect(store.get().slots).toEqual([])
})

test('signing in again keeps the remembered organization only for the same user', () => {
    const store = new AuthStore('https://fleet.test')
    store.updateSlot(0, { ...account('first', 'ada'), lastOrgSlug: 'acme' })
    expect(store.signIn(0, { token: 'second', user: user('ada') })).toBe(0)
    expect(store.get().slots[0]).toEqual({
        token: 'second',
        user: user('ada'),
        lastOrgSlug: 'acme',
    })

    store.signIn(0, { token: 'third', user: user('grace') })
    expect(store.get().slots[0]).toEqual({ token: 'third', user: user('grace'), lastOrgSlug: null })
})
