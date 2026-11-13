import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { cn } from 'cn'

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
    return (
        <TabsPrimitive.Root
            data-slot="tabs"
            className={cn('flex min-w-0 flex-col', className)}
            {...props}
        />
    )
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            className={cn('flex h-full items-stretch gap-1 text-muted-foreground', className)}
            {...props}
        />
    )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
    return (
        <TabsPrimitive.Tab
            data-slot="tabs-trigger"
            className={cn(
                '-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none hover:text-foreground focus-visible:border-ring data-active:border-foreground data-active:text-foreground disabled:pointer-events-none disabled:opacity-50',
                className,
            )}
            {...props}
        />
    )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
    return (
        <TabsPrimitive.Panel
            data-slot="tabs-content"
            className={cn('min-h-0 flex-1 outline-none', className)}
            {...props}
        />
    )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
