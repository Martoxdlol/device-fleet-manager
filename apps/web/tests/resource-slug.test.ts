import { expect, test } from 'bun:test'
import { isSlug, resourceSlug } from '../src/components/forms/resource-slug'

test('slugs derived from names are ones the server accepts', () => {
    const fallback = 'resource-1a2b3c4d'
    expect(resourceSlug('  Acme, Corp. (Main)  ', fallback)).toBe('acme-corp-main')
    expect(resourceSlug('Ñandú Sistemas', fallback)).toBe('nandu-sistemas')
    expect(resourceSlug('X', fallback)).toBe('x-2')
    expect(resourceSlug('東京', fallback)).toBe(fallback)
    for (const name of ['  Acme  ', 'a--b', `${'word '.repeat(30)}`, 'X', 'Ñ', '--', '東京'])
        expect(isSlug(resourceSlug(name, fallback))).toBe(true)
    expect(isSlug('Acme')).toBe(false)
    expect(isSlug('acme--corp')).toBe(false)
    expect(isSlug('a')).toBe(false)
})
