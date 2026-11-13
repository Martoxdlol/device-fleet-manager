export const SLUG_MIN = 2
export const SLUG_MAX = 56

export function isSlug(value: string) {
    return (
        value.length >= SLUG_MIN &&
        value.length <= SLUG_MAX &&
        /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
    )
}

export function resourceSlug(name: string, fallback: string) {
    const slug = name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, SLUG_MAX)
        .replace(/-$/, '')
    if (!slug) return fallback
    return slug.length < SLUG_MIN ? `${slug}-2` : slug
}
