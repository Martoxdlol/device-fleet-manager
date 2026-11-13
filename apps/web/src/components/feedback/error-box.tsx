import type { ReactElement } from 'react'
import { isRouteErrorResponse } from 'react-router'
import { cn } from 'cn'
import { Icon } from '../../core/ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '../../core/ui/popover'
import { Button } from '../../core/ui/primitives'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../core/ui/tooltip'
import { useMessages } from '../../i18n/provider'

const chunkFailure =
    /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

/** A lazy chunk that is gone, as after a deploy while the tab ran the old build. */
function isChunkLoadError(error: unknown) {
    return error instanceof TypeError && chunkFailure.test(error.message)
}

function describe(error: unknown) {
    if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`
    if (error instanceof Error) {
        const stack = import.meta.env.DEV ? error.stack : undefined
        return stack?.includes(error.message)
            ? stack
            : [error.message, stack].filter(Boolean).join('\n')
    }
    return error === undefined || error === null ? '' : String(error)
}

/**
 * What every error boundary shows in place of what crashed: a line and one button, or in a
 * narrow container the alert icon alone. The line or the icon opens what went wrong. Try again
 * resets the boundary; after a failed chunk load, or with nothing to reset, the button reloads.
 */
export function ErrorBox({
    error,
    onRetry,
    className,
}: {
    error: unknown
    onRetry?: () => void
    className?: string
}) {
    const t = useMessages()
    const stale = isChunkLoadError(error)
    const text = stale ? t.errors.newVersion : t.errors.somethingWentWrong
    const action =
        stale || !onRetry
            ? { label: t.errors.reload, run: () => window.location.reload() }
            : { label: t.common.retry, run: onRetry }
    const details = describe(error)
    const popover = (trigger: ReactElement, withAction: boolean) => (
        <Popover>
            <PopoverTrigger render={trigger} />
            <PopoverContent aria-label={t.errors.details} className="grid w-80 max-w-[90vw] gap-2">
                <pre className="max-h-64 overflow-auto font-mono text-[11px] break-words whitespace-pre-wrap">
                    {details || t.errors.noDetails}
                </pre>
                <div className="flex justify-end gap-2">
                    {details && (
                        <Button
                            size="xs"
                            variant="outline"
                            onClick={() => void navigator.clipboard?.writeText(details)}
                        >
                            {t.common.copy}
                        </Button>
                    )}
                    {withAction && (
                        <Button size="xs" variant="destructive" onClick={action.run}>
                            {action.label}
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
    return (
        <div role="alert" className={cn('@container/error w-full', className)}>
            <div className="hidden items-center gap-3 bg-destructive/10 p-3 text-destructive @min-[14rem]/error:flex">
                <Icon name="alert" className="size-4 shrink-0" aria-hidden="true" />
                {popover(
                    <button
                        type="button"
                        aria-label={`${text}. ${t.errors.showDetails}`}
                        className="min-w-0 flex-1 cursor-pointer text-left text-[13px] underline-offset-4 outline-none hover:underline focus-visible:underline"
                    >
                        {text}
                    </button>,
                    false,
                )}
                <Button size="sm" variant="destructive" onClick={action.run}>
                    {action.label}
                </Button>
            </div>
            <div className="flex justify-center @min-[14rem]/error:hidden">
                <Tooltip>
                    {popover(
                        <TooltipTrigger
                            render={
                                <button
                                    type="button"
                                    aria-label={text}
                                    className="grid size-8 cursor-pointer place-items-center bg-destructive/10 text-destructive outline-none hover:bg-destructive/20 focus-visible:ring-1 focus-visible:ring-destructive/40"
                                >
                                    <Icon name="alert" className="size-4" aria-hidden="true" />
                                </button>
                            }
                        />,
                        true,
                    )}
                    <TooltipContent side="right" sideOffset={8}>
                        {text}
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    )
}
