import { cn } from 'cn'
import type { ReactNode } from 'react'
import { Surface } from '../ui/primitives'

export function SidePanel({
    label,
    className,
    children,
}: {
    label: string
    className?: string
    children: ReactNode
}) {
    return (
        <Surface
            className={cn(
                'desktop-panel h-full overflow-auto overscroll-contain scrollbar-thin',
                className,
            )}
            role="region"
            aria-label={label}
        >
            {children}
        </Surface>
    )
}
