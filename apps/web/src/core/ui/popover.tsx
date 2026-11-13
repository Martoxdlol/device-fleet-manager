import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from 'cn'

function Popover(props: PopoverPrimitive.Root.Props) {
    return <PopoverPrimitive.Root {...props} />
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
    return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
    className,
    side = 'bottom',
    align = 'start',
    sideOffset = 4,
    ...props
}: PopoverPrimitive.Popup.Props & {
    side?: PopoverPrimitive.Positioner.Props['side']
    align?: PopoverPrimitive.Positioner.Props['align']
    sideOffset?: number
}) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Positioner
                side={side}
                align={align}
                sideOffset={sideOffset}
                className="isolate z-50 outline-none"
            >
                <PopoverPrimitive.Popup
                    data-slot="popover-content"
                    className={cn(
                        'bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none',
                        className,
                    )}
                    {...props}
                />
            </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
    )
}

export { Popover, PopoverTrigger, PopoverContent }
