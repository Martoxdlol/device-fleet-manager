import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { cn } from 'cn'

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
    return (
        <RadioGroupPrimitive
            data-slot="radio-group"
            className={cn('grid gap-1', className)}
            {...props}
        />
    )
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
    return (
        <RadioPrimitive.Root
            data-slot="radio-group-item"
            className={cn(
                'peer relative grid aspect-square size-4 shrink-0 place-items-center rounded-full border border-input outline-none transition-colors after:absolute after:-inset-2 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:bg-input/30 dark:data-checked:bg-primary',
                className,
            )}
            {...props}
        >
            <RadioPrimitive.Indicator
                data-slot="radio-group-indicator"
                className="size-1.5 rounded-full bg-primary-foreground"
            />
        </RadioPrimitive.Root>
    )
}

export { RadioGroup, RadioGroupItem }
