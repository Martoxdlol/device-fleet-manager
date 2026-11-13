import { Button } from '../ui/primitives'
import { Icon } from '../ui/icon'
import { SheetClose } from '../ui/sheet'
import { cn } from 'cn'
import { useContext, type ComponentProps } from 'react'
import { PanelSheetContext } from './panel-sheet-context'
import { useLocale } from '../locale/locale-context'

export const barClasses = 'flex h-[45px] shrink-0 items-center gap-2 border-b p-1.5'

export function PanelHeader({ className, children, ...props }: ComponentProps<'header'>) {
    const t = useLocale().messages
    const sheet = useContext(PanelSheetContext)
    return (
        <header className={cn(barClasses, className)} {...props}>
            {children}
            {sheet && (
                <SheetClose render={<PanelAction iconOnly aria-label={t.close} />}>
                    <Icon name="close" />
                </SheetClose>
            )}
        </header>
    )
}

export function PanelTitle({ className, ...props }: ComponentProps<'h2'>) {
    return (
        <h2
            className={cn('min-w-0 flex-1 truncate pl-2.5 text-[13px] font-medium', className)}
            {...props}
        />
    )
}

export function PanelActions({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div className={cn('ml-auto flex shrink-0 items-center gap-1.5', className)} {...props} />
    )
}

export function PanelBody({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex min-w-0 flex-col gap-3 p-(--space-padding)', className)}
            {...props}
        />
    )
}

export function PanelAction({
    className,
    iconOnly = false,
    compact = false,
    ...props
}: ComponentProps<typeof Button> & { iconOnly?: boolean; compact?: boolean }) {
    const classes = (extra?: string) =>
        cn(
            'h-8 shrink-0 text-xs',
            iconOnly && 'size-8 p-0',
            compact && '@max-[600px]/app:size-8 @max-[600px]/app:p-0',
            extra,
        )
    return (
        <Button
            variant="ghost"
            {...props}
            className={
                typeof className === 'function'
                    ? (state) => classes(className(state))
                    : classes(className)
            }
        />
    )
}
