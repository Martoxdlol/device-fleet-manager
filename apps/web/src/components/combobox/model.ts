export function matchesSearch(label: string, search: string) {
    const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    return normalize(label).includes(normalize(search.trim()))
}

export function groupItems<T>(
    items: readonly T[],
    getItemGroup?: (item: T) => string | undefined,
): readonly T[] {
    if (!getItemGroup) return items
    const loose: T[] = []
    const groups = new Map<string, T[]>()
    for (const item of items) {
        const group = getItemGroup(item)
        if (group === undefined) loose.push(item)
        else groups.set(group, [...(groups.get(group) ?? []), item])
    }
    return [...loose, ...[...groups.values()].flat()]
}

export function filterItems<T>(
    items: readonly T[],
    search: string,
    getItemLabel: (item: T) => string,
    filter?: ((item: T, search: string) => boolean) | null,
): readonly T[] {
    if (filter === null || !search.trim()) return items
    return items.filter((item) =>
        filter ? filter(item, search) : matchesSearch(getItemLabel(item), search),
    )
}
