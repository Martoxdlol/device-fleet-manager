import { cn } from 'cn'
import { flatSurfaceClasses, surfaceClasses } from './surface'
import { useSpacing, spacingVariables } from '../scaffold/spacing-context'

import {
    useId,
    type ComponentProps,
    type HTMLAttributes,
    type ReactElement,
    type ReactNode,
} from 'react'
import { Button as ShadcnButton } from './button'
import { Badge as ShadcnBadge } from './badge'
import { Label } from './label'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import {
    Dialog as DialogRoot,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from './dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './sheet'
import { useLocale } from '../locale/locale-context'
import { useBoundary } from '../boundary/boundary-context'

export function Button({
    variant = 'outline',
    className = '',
    ...props
}: ComponentProps<typeof ShadcnButton>) {
    return <ShadcnButton type="button" variant={variant} className={className} {...props} />
}

export function Surface({
    flat = false,
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement> & { flat?: boolean }) {
    return <div className={cn(flat ? flatSurfaceClasses : surfaceClasses, className)} {...props} />
}
export function Badge({
    destructive = false,
    children,
}: {
    destructive?: boolean
    children: ReactNode
}) {
    return <ShadcnBadge variant={destructive ? 'destructive' : 'secondary'}>{children}</ShadcnBadge>
}
const fieldClasses =
    'field flex flex-col items-stretch gap-1.5 text-[12px] leading-[1.5] [&_small]:text-muted-foreground [&_small]:font-normal'

export function Field({
    label,
    children,
    hint,
    error,
    group = false,
    actions,
}: {
    label: string
    children: ReactNode
    hint?: string
    error?: string
    group?: boolean
    actions?: ReactNode
}) {
    const id = useId()
    const grouped = group || !!actions
    const name = <span id={grouped ? id : undefined}>{label}</span>
    const content = (
        <>
            {actions ? (
                <div className="flex min-h-6 items-center gap-0.5 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate">
                    {name}
                    {actions}
                </div>
            ) : (
                name
            )}
            {children}
            {error && (
                <span role="alert" className="font-normal text-destructive">
                    {error}
                </span>
            )}
            {hint && <small>{hint}</small>}
        </>
    )
    return grouped ? (
        <div role="group" aria-labelledby={id} className={fieldClasses}>
            {content}
        </div>
    ) : (
        <Label className={fieldClasses}>{content}</Label>
    )
}
export function Dialog({
    open,
    onClose,
    title,
    description,
    side = 'center',
    wide = false,
    children,
}: {
    open: boolean
    onClose: () => void
    title: string
    description?: string
    side?: 'center' | 'right' | 'bottom'
    wide?: boolean
    children: ReactNode
}) {
    const spacing = useSpacing()
    const Boundary = useBoundary()
    const style = spacingVariables(spacing)
    if (side !== 'center')
        return (
            <Sheet
                open={open}
                onOpenChange={(value) => {
                    if (!value) onClose()
                }}
            >
                <SheetContent
                    side={side}
                    className="app-sheet max-h-(--viewport-height) [&[data-side=bottom]_.sheet-body]:max-h-[calc(var(--viewport-height)*0.65)]"
                    style={style}
                >
                    <SheetHeader>
                        <SheetTitle>{title}</SheetTitle>
                        {description && <SheetDescription>{description}</SheetDescription>}
                    </SheetHeader>
                    <div className="sheet-body flex-1 min-h-0 overflow-y-auto p-[0_16px_max(16px,var(--safe-area-bottom))]">
                        <Boundary name="dialog">{children}</Boundary>
                    </div>
                </SheetContent>
            </Sheet>
        )
    return (
        <DialogRoot
            open={open}
            onOpenChange={(value) => {
                if (!value) onClose()
            }}
        >
            <DialogContent
                className={cn(
                    'app-dialog max-h-[calc(var(--viewport-height)*0.9)] min-w-0 grid-cols-[minmax(0,1fr)] overflow-y-auto',
                    wide && 'sm:max-w-4xl',
                )}
                style={style}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                <Boundary name="dialog">{children}</Boundary>
            </DialogContent>
        </DialogRoot>
    )
}

const emptyStateClasses =
    'flex flex-col items-center justify-center gap-3 min-h-80 p-6 text-center [&_p]:text-muted-foreground [&_p]:text-[12px] [&_p]:leading-[1.65] [&_h2]:text-[20px]'

export function EmptyState({
    surface = false,
    className,
    ...props
}: ComponentProps<'div'> & { surface?: boolean }) {
    return (
        <div className={cn(emptyStateClasses, surface && surfaceClasses, className)} {...props} />
    )
}

export function Spinner({ label, className }: { label?: string; className?: string }) {
    const t = useLocale().messages
    return (
        <span role="status" className={cn('inline-flex', className)}>
            <span
                aria-hidden="true"
                className="block size-4.5 rounded-full border-2 border-border border-t-muted-foreground animate-spin motion-reduce:animate-none"
            />
            <span className="sr-only">{label ?? t.loading}</span>
        </span>
    )
}

export function PageSpinner() {
    return (
        <EmptyState>
            <Spinner />
        </EmptyState>
    )
}

export function ChromeTip({
    label,
    enabled = true,
    side = 'right',
    children,
}: {
    label: string
    enabled?: boolean
    side?: 'top' | 'right' | 'bottom' | 'left'
    children: ReactElement
}) {
    if (!enabled) return children
    return (
        <Tooltip>
            <TooltipTrigger render={children} />
            <TooltipContent side={side} sideOffset={8}>
                {label}
            </TooltipContent>
        </Tooltip>
    )
}
