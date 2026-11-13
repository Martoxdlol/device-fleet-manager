import { useState } from 'react'
import { isSlug, resourceSlug } from './resource-slug'

export function useNameSlug(initialName = '') {
    const [name, setName] = useState(initialName)
    const [fallback] = useState(() => `resource-${Math.random().toString(36).slice(2, 10)}`)
    const [custom, setCustom] = useState<string | null>(null)
    const slug = custom ?? resourceSlug(name, fallback)
    return {
        name,
        setName,
        slug,
        custom,
        setCustom,
        valid: !!name.trim() && isSlug(slug),
    }
}

export type NameSlug = ReturnType<typeof useNameSlug>
