import { createContext, useContext, type CSSProperties } from 'react'
export interface Spacing {
    gap: number
    padding: number
    railWidth: number
}
const defaults: Spacing = {
    gap: 12,
    padding: 16,
    railWidth: 56,
}
export const SpacingContext = createContext(defaults)
export const useSpacing = () => useContext(SpacingContext)

export function spacingVariables(spacing: Spacing): CSSProperties {
    return Object.fromEntries(
        Object.entries(spacing).map(([key, value]) => [`--space-${key}`, `${value}px`]),
    ) as CSSProperties
}
