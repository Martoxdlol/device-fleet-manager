import type { IconName } from '../ui/icon'

export interface PageAction {
    id: string
    label: string
    icon: IconName
    onSelect: () => void
    disabled?: boolean
    priority?: number
}

/** The actions shown in the top bar, highest priority first, and the rest a phone keeps in a menu. */
export function rankActions(actions: PageAction[], mobile: boolean) {
    const sorted = [...actions].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    return mobile
        ? { shown: sorted.slice(0, 1), overflow: sorted.slice(1) }
        : { shown: sorted, overflow: [] }
}
