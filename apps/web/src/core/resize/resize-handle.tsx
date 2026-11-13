import { cn } from 'cn'
import type { ComponentProps } from 'react'

export function ResizeHandle({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            data-slot="resize-handle"
            className={cn(
                "flex touch-none items-stretch justify-center outline-none after:rounded-full after:bg-transparent after:transition-colors after:content-[''] hover:after:bg-border focus-visible:after:bg-ring data-[dragging=true]:after:bg-foreground",
                'aria-[orientation=vertical]:cursor-col-resize aria-[orientation=vertical]:after:my-3 aria-[orientation=vertical]:after:w-0.5',
                'aria-[orientation=horizontal]:cursor-row-resize aria-[orientation=horizontal]:flex-col aria-[orientation=horizontal]:after:mx-3 aria-[orientation=horizontal]:after:h-0.5',
                className,
            )}
            {...props}
        />
    )
}
