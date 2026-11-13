import { describe, expect, test } from 'bun:test'
import { createQueryClient } from '../src/lib/api/query-client'
import { errorMessage, retryQuery } from '../src/lib/api/errors'
import { en } from '../src/i18n/en'

describe('api foundation', () => {
    test('API errors keep their message; only transient reads retry, with a limit', () => {
        for (const code of ['unauthenticated', 'forbidden', 'not_found', 'conflict']) {
            expect(retryQuery(0, { error: code, message: 'Request failed' })).toBe(false)
        }
        expect(retryQuery(0, { error: 'unavailable', message: 'Temporarily unavailable' })).toBe(
            true,
        )
        expect(retryQuery(0, new TypeError('Failed to fetch'))).toBe(true)
        expect(retryQuery(2, new TypeError('Failed to fetch'))).toBe(false)
        expect(errorMessage({ error: 'conflict', message: 'Already in use' }, en)).toBe(
            'Already in use',
        )
        expect(errorMessage(new TypeError('Failed to fetch'), en)).toContain('try again')
        expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false)
    })
})
