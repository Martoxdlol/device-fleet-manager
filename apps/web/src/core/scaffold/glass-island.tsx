import { cn } from 'cn'
import { planeClasses } from '../ui/surface'
import type { ComponentProps } from 'react'

export function GlassIsland({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            data-slot="glass-island"
            className={cn(
                'pointer-events-auto bg-sidebar/70 text-sidebar-foreground backdrop-blur-xl backdrop-saturate-150',
                planeClasses,
                className,
            )}
            {...props}
        />
    )
}
