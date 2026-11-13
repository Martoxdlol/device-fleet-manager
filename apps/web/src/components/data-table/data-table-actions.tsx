import { toolbarActionClasses } from './toolbar-styles'
import { useContext, useLayoutEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../core/ui/dropdown-menu'
import { actionContext, resolveActions } from './action-model'
import { DataTableAction, DataTableSelection } from './data-table-toolbar'
import { ToolMenuContext, ToolbarFoldContext } from './toolbar-fold'
import type { DataTableActionDef, DataTableController } from './types'
import { useMessages } from '../../i18n/provider'

/**
 * The button row is capped to the buttons it renders, so free space is what the toolbar's leading
 * group, or the row's parent outside a toolbar, has left once everything beside the row takes its
 * room. It goes below zero when they already overflow.
 */
function availableWidth(element: HTMLElement) {
    const stop = element.closest<HTMLElement>('.dt-toolbar-leading') ?? element.parentElement
    if (!stop) return element.clientWidth
    let space = stop.clientWidth
    for (let node = element; node !== stop && node.parentElement; node = node.parentElement) {
        const row = node.parentElement
        const gap = parseFloat(getComputedStyle(row).columnGap) || 0
        for (const child of row.children)
            if (child !== node && getComputedStyle(child).display !== 'none')
                space -= child.getBoundingClientRect().width + gap
    }
    return space
}

/** Selection-aware actions; zero selections don't suppress global actions. */
export function DataTableActions<T>({
    table,
    rows,
    actions,
}: {
    table: DataTableController<T>
    rows: readonly T[]
    actions: readonly DataTableActionDef<T>[]
}) {
    const t = useMessages()
    const fold = useContext(ToolbarFoldContext)
    const { space: toolSpace, isFolded, setFolded } = fold ?? {}
    const context = actionContext(table.selection, rows, table.getRowId, 'toolbar')
    const resolved = resolveActions(actions, context)
    const container = useRef<HTMLDivElement>(null)
    const measurements = useRef<HTMLDivElement>(null)
    const [visibleCount, setVisibleCount] = useState(Infinity)
    const actionKeys = JSON.stringify(resolved.map(({ action }) => action.key))

    useLayoutEffect(() => {
        const element = container.current
        const sizing = measurements.current
        if (!element || !sizing) return
        const measure = () => {
            const widths = Array.from(
                sizing.children,
                (child) => child.getBoundingClientRect().width,
            )
            const overflowWidth = widths.pop() ?? 0
            const gap = parseFloat(getComputedStyle(element).columnGap) || 0
            const tools = toolSpace?.() ?? 0
            const available = availableWidth(element)
            // The room the actions would have with the tools beside them.
            const beside = isFolded?.() ? available - tools : available
            const total =
                widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap
            const folding = tools > 0 && total > beside && overflowWidth > beside
            const space = folding ? beside + tools : beside
            let count = widths.length
            if (folding || total > space) {
                count = 0
                let used = overflowWidth
                for (const width of widths) {
                    if (used + gap + width > space) break
                    used += gap + width
                    count++
                }
            }
            setFolded?.(folding)
            setVisibleCount(count)
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        observer.observe(sizing)
        const leading = element.closest('.dt-toolbar-leading')
        if (leading) observer.observe(leading)
        else if (element.parentElement) observer.observe(element.parentElement)
        return () => observer.disconnect()
    }, [actionKeys, toolSpace, isFolded, setFolded])
    // Without actions to hold them, the tools go back beside the leading group.
    useLayoutEffect(() => () => setFolded?.(false), [setFolded])

    if (!resolved.length && !context.selectionCount) return null
    return (
        <DataTableSelection table={table} showWhenEmpty>
            {resolved.length > 0 && (
                <div
                    className="dt-responsive-actions relative flex w-0 max-w-fit min-w-9 flex-1 items-center justify-end gap-1"
                    ref={container}
                >
                    <div
                        className="dt-actions-measure pointer-events-none invisible absolute flex h-0 w-max max-w-full overflow-hidden [&>span]:inline-flex [&>span]:items-center [&>span]:justify-center [&>span]:border [&>span]:border-transparent [&>span]:whitespace-nowrap [&_svg]:size-4"
                        ref={measurements}
                        aria-hidden="true"
                        inert
                    >
                        {resolved.map(({ action }) => (
                            <span
                                key={action.key}
                                className={toolbarActionClasses(action.showLabel)}
                            >
                                {action.icon}
                                {action.showLabel && (
                                    <span className="dt-toolbar-label leading-[18px] @max-[600px]/table:hidden">
                                        {action.label}
                                    </span>
                                )}
                            </span>
                        ))}
                        <span className={toolbarActionClasses()}>
                            <MoreHorizontal />
                        </span>
                    </div>
                    {resolved.slice(0, visibleCount).map(({ action, disabled, tooltip }) => (
                        <DataTableAction
                            key={action.key}
                            label={action.label}
                            icon={action.icon}
                            tooltip={tooltip}
                            disabled={disabled}
                            focusableWhenDisabled
                            showLabel={action.showLabel}
                            className={
                                action.variant === 'destructive'
                                    ? 'dt-delete-action text-destructive'
                                    : undefined
                            }
                            onClick={() => {
                                if (!disabled) action.onClick(context)
                            }}
                        />
                    ))}
                    {(visibleCount < resolved.length || !!fold?.folded) && (
                        <DropdownMenu>
                            <DataTableAction
                                label={t.components.dataTable.moreActions}
                                icon={<MoreHorizontal />}
                                render={<DropdownMenuTrigger />}
                            />
                            <DropdownMenuContent
                                align="end"
                                className="dt-action-menu w-60 max-w-[calc(100vw-16px)]"
                            >
                                {resolved
                                    .slice(visibleCount)
                                    .map(({ action, disabled, tooltip }) => (
                                        <DropdownMenuItem
                                            key={action.key}
                                            disabled={disabled}
                                            variant={action.variant}
                                            onClick={() => {
                                                if (!disabled) action.onClick(context)
                                            }}
                                        >
                                            {action.icon}
                                            <span>
                                                <span>{action.label}</span>
                                                {disabled && tooltip !== action.label && (
                                                    <span className="dt-action-reason mt-0.5 block text-[11px] leading-[1.4]">
                                                        {tooltip}
                                                    </span>
                                                )}
                                            </span>
                                        </DropdownMenuItem>
                                    ))}
                                {fold?.folded && (
                                    <>
                                        {visibleCount < resolved.length && (
                                            <DropdownMenuSeparator />
                                        )}
                                        <ToolMenuContext value>{fold.tools}</ToolMenuContext>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}
        </DataTableSelection>
    )
}
