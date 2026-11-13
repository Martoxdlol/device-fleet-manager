import { cn } from 'cn'

/** Visible actions and their sizing probes must use exactly the same geometry. */
export function toolbarActionClasses(showLabel = false, className?: string) {
    return cn(
        'dt-toolbar-button inline-flex h-8 shrink-0 items-center justify-center text-xs font-normal leading-[18px] text-foreground transition-colors duration-[140ms] not-disabled:not-aria-disabled:hover:bg-[color-mix(in_oklab,var(--foreground)_4%,var(--card))] aria-disabled:cursor-not-allowed aria-disabled:opacity-45 [&>svg]:block [&>svg]:size-4 [&>svg]:flex-none [&>svg]:stroke-[1.65] [&>svg]:opacity-72',
        showLabel
            ? 'dt-toolbar-labeled gap-2 px-2.5 @max-[600px]/table:size-9 @max-[600px]/table:gap-0 @max-[600px]/table:px-0'
            : 'dt-toolbar-icon size-9 gap-0 px-0',
        className,
    )
}
