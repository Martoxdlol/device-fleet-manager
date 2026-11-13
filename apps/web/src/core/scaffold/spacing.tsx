import { SpacingContext, useSpacing, spacingVariables, type Spacing } from './spacing-context'
import { type ReactNode } from 'react'
export function SpacingProvider({
    value,
    children,
}: {
    value?: Partial<Spacing>
    children: ReactNode
}) {
    const parent = useSpacing()
    const spacing = { ...parent, ...value }
    const style = spacingVariables(spacing)
    return (
        <SpacingContext value={spacing}>
            <div className="min-w-0" style={style}>
                {children}
            </div>
        </SpacingContext>
    )
}
