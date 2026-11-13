import { cn } from 'cn'
import { planeClasses } from '../ui/surface'
import type { ComponentProps } from 'react'

/**
 * Floating chrome: the top bar, the mobile nav, the mobile toolbar row. Same plane as
 * `Surface`, over a translucent background instead of an opaque one, because these sit over
 * page content rather than beside it.
 *
 * `pointer-events-auto` re-enables interaction inside the scaffold's `pointer-events-none`
 * floating slots, so the island catches clicks while the gaps between islands stay
 * click-through to whatever is behind.
 */
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
