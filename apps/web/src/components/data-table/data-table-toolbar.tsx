import { toolbarActionClasses } from './toolbar-styles'
import { PanelHeader } from '../../core/layout/panel'
import { Fragment, useContext, useRef, useState } from 'react'
import { ToolMenuContext, ToolbarFoldContext, type ToolbarFold } from './toolbar-fold'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { cn } from 'cn'
import { ArrowDownUp, Columns3, Filter, LayoutGrid, List, Search, X } from 'lucide-react'
import { Button } from '../../core/ui/primitives'
import { Input } from '../../core/ui/input'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from '../../core/ui/dropdown-menu'
import type { DataTableController, DataTableFilterGroup } from './types'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../core/ui/tooltip'
import { useFormat, useMessages } from '../../i18n/provider'

/** Icons by default; tooltips and aria-labels carry the name. */
export function DataTableAction({
    label,
    icon,
    tooltip = label,
    showLabel = false,
    className = '',
    ...props
}: Omit<ComponentProps<typeof Button>, 'children'> & {
    label: string
    icon: ReactNode
    tooltip?: string
    showLabel?: boolean
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label={label}
                        className={
                            typeof className === 'function'
                                ? (state) => toolbarActionClasses(showLabel, className(state))
                                : toolbarActionClasses(showLabel, className)
                        }
                        {...props}
                    />
                }
            >
                {icon}
                {showLabel && (
                    <span className="dt-toolbar-label leading-[18px] @max-[600px]/table:hidden">
                        {label}
                    </span>
                )}
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
                {tooltip}
            </TooltipContent>
        </Tooltip>
    )
}

/** All filter controls live in one menu, separate from record actions. */
export function DataTableFilters({ filters }: { filters: readonly DataTableFilterGroup[] }) {
    const t = useMessages()
    const format = useFormat()
    const inMenu = useContext(ToolMenuContext)
    const active = filters.filter((filter) => filter.value !== filter.defaultValue)
    const label = active.length
        ? t.components.dataTable.activeFilters(active.length, format.number(active.length))
        : t.common.filters
    const content = (
        <>
            {filters.map((filter, index) => (
                <DropdownMenuGroup key={filter.key}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel>{filter.label}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                        value={filter.value}
                        onValueChange={filter.onValueChange}
                    >
                        {filter.options.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
            ))}
            {active.length > 0 && (
                <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => {
                            for (const filter of active) filter.onValueChange(filter.defaultValue)
                        }}
                    >
                        {t.components.dataTable.clearFilters}
                    </DropdownMenuItem>
                </>
            )}
        </>
    )
    if (inMenu)
        return (
            <DropdownMenuSub>
                <DropdownMenuSubTrigger aria-label={label}>
                    <Filter />
                    {label}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="dt-view-menu min-w-[220px]">
                    {content}
                </DropdownMenuSubContent>
            </DropdownMenuSub>
        )
    return (
        <DropdownMenu>
            <DataTableAction
                label={t.common.filters}
                icon={<Filter />}
                aria-label={label}
                tooltip={label}
                className={
                    active.length
                        ? 'dt-filters-active relative bg-muted after:absolute after:-top-0.5 after:-right-0.5 after:grid after:h-[13px] after:min-w-[13px] after:place-items-center after:bg-foreground after:px-0.5 after:text-[9px] after:leading-none after:text-card after:content-[attr(data-active-count)]'
                        : undefined
                }
                data-active-count={active.length || undefined}
                data-dt-tool
                render={<DropdownMenuTrigger />}
            />
            <DropdownMenuContent align="end" className="dt-view-menu min-w-[220px]">
                {content}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export function DataTableToolbar({
    children,
    actions,
    className = '',
}: {
    children?: ReactNode
    actions?: ReactNode
    className?: string
}) {
    const t = useMessages()
    const tools = useRef<HTMLDivElement>(null)
    const foldedNow = useRef(false)
    const [folded, setFolded] = useState(false)
    const [controls] = useState(() => ({
        isFolded: () => foldedNow.current,
        setFolded: (next: boolean) => {
            if (foldedNow.current === next) return
            foldedNow.current = next
            setFolded(next)
        },
        space: () => {
            const element = tools.current
            const items = element ? Array.from(element.children) : []
            if (!items.length || !items.every((item) => item.hasAttribute('data-dt-tool'))) return 0
            const gap = parseFloat(getComputedStyle(element!.parentElement!).columnGap) || 0
            // The rule is a pixel wide, with the bar's gap on either side.
            return element!.getBoundingClientRect().width + 1 + 2 * gap
        },
    }))
    const fold: ToolbarFold = { ...controls, tools: actions, folded }
    return (
        <ToolbarFoldContext value={fold}>
            <PanelHeader
                className={`dt-toolbar relative flex-nowrap px-2 [&:has(.dt-toolbar-actions:empty)_.dt-toolbar-rule]:hidden ${className}`}
            >
                <div
                    className="dt-toolbar-leading flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 [&>*]:shrink-0"
                    role="group"
                    aria-label={t.components.dataTable.toolbar}
                >
                    {children}
                </div>
                {/* A sibling of both groups, so the bar's own gap sets the space on either side of
                it. It goes when the group it introduces is empty or folded. */}
                {!folded && (
                    <div aria-hidden className="dt-toolbar-rule h-5 w-px shrink-0 bg-border" />
                )}
                {/* Folded, the tools stay laid out out of sight, so their room is still known. */}
                <div
                    ref={tools}
                    className={cn(
                        'dt-toolbar-actions flex min-w-0 shrink-0 flex-nowrap items-center gap-1.5',
                        folded && 'pointer-events-none invisible absolute top-0 right-0',
                    )}
                    aria-hidden={folded || undefined}
                    inert={folded}
                >
                    {actions}
                </div>
            </PanelHeader>
        </ToolbarFoldContext>
    )
}

export function DataTableSearch({
    value,
    onChange,
    placeholder: ownPlaceholder,
}: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}) {
    const t = useMessages()
    const placeholder = ownPlaceholder ?? t.common.search
    return (
        <label className="dt-search relative flex w-[180px] max-w-full items-center @max-[600px]/table:w-[145px] @max-[600px]/table:min-w-16 @max-[600px]/table:flex-[0_1_92px] @max-[400px]/table:basis-20">
            <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-[9px] size-3.5 text-muted-foreground"
            />
            <Input
                className="h-8 border-transparent bg-transparent px-[29px] py-0 text-xs shadow-none hover:bg-muted focus-visible:border-ring md:text-xs"
                aria-label={placeholder}
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
            {value && (
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <button
                                type="button"
                                className="absolute right-[7px] p-0.5 text-muted-foreground [&_svg]:size-[13px]"
                                aria-label={t.common.clearSearch}
                                onClick={() => onChange('')}
                            />
                        }
                    >
                        <X />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t.common.clearSearch}</TooltipContent>
                </Tooltip>
            )}
        </label>
    )
}

/** Switches between the list and the tile grid. Only meaningful when the table has a `tile`. */
export function DataTableViewToggle<T>({ table }: { table: DataTableController<T> }) {
    const t = useMessages().components.dataTable
    const inMenu = useContext(ToolMenuContext)
    const grid = table.view === 'grid'
    const label = grid ? t.listView : t.gridView
    const icon = grid ? <List /> : <LayoutGrid />
    const toggle = () => table.setView(grid ? 'list' : 'grid')
    if (inMenu)
        return (
            <DropdownMenuItem onClick={toggle}>
                {icon}
                {label}
            </DropdownMenuItem>
        )
    return (
        <DataTableAction
            label={label}
            icon={icon}
            aria-pressed={grid}
            data-dt-tool
            onClick={toggle}
        />
    )
}

function SortItems<T>({ table }: { table: DataTableController<T> }) {
    const t = useMessages().components.dataTable
    const columns = table.columns.filter((column) => column.sortable)
    return (
        <>
            <DropdownMenuRadioGroup
                value={table.sort?.key ?? ''}
                onValueChange={(value) => table.setSort(value, table.sort?.direction ?? 'asc')}
            >
                {columns.map((column) => (
                    <DropdownMenuRadioItem key={column.key} value={column.key}>
                        {column.header}
                    </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
                value={table.sort?.direction ?? ''}
                onValueChange={(value) => {
                    if (table.sort && (value === 'asc' || value === 'desc'))
                        table.setSort(table.sort.key, value)
                }}
            >
                <DropdownMenuRadioItem value="asc" disabled={!table.sort}>
                    {t.ascending}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc" disabled={!table.sort}>
                    {t.descending}
                </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
        </>
    )
}

/**
 * Layout or tile size, sort and visible properties in one menu. Pass `grid` when the
 * table renders tiles so the layout switch and tile sizes appear.
 */
export function DataTableViewOptions<T>({
    table,
    grid = false,
    children,
}: {
    table: DataTableController<T>
    grid?: boolean
    children?: ReactNode
}) {
    const t = useMessages().components.dataTable
    const inMenu = useContext(ToolMenuContext)
    const tiles = grid && table.view === 'grid'
    const sortable = table.columns.some((column) => column.sortable)
    const sections = [
        grid && (
            <DropdownMenuGroup key="layout">
                <DropdownMenuLabel>{t.layout}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={table.view}
                    onValueChange={(value) => {
                        if (value === 'list' || value === 'grid') table.setView(value)
                    }}
                >
                    <DropdownMenuRadioItem value="list">
                        <List />
                        {t.list}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="grid">
                        <LayoutGrid />
                        {t.grid}
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
        ),
        tiles && (
            <DropdownMenuGroup key="tile-size">
                <DropdownMenuLabel>{t.tileSize}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={table.tileSize}
                    onValueChange={(value) => {
                        if (value === 'sm' || value === 'md' || value === 'lg')
                            table.setTileSize(value)
                    }}
                >
                    <DropdownMenuRadioItem value="sm">{t.small}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="md">{t.medium}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="lg">{t.large}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
        ),
        sortable && (
            <DropdownMenuSub key="sort">
                <DropdownMenuSubTrigger>
                    <ArrowDownUp />
                    {t.sort}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[180px]">
                    <SortItems table={table} />
                </DropdownMenuSubContent>
            </DropdownMenuSub>
        ),
        !tiles && (
            <DropdownMenuGroup key="properties">
                <DropdownMenuLabel>
                    <span className="dt-menu-label flex items-center gap-[7px]">
                        <Columns3 size={13} />
                        {t.columns}
                    </span>
                </DropdownMenuLabel>
                {table.columns.map((column) => {
                    const visible = table.visibleColumns.some((item) => item.key === column.key)
                    return (
                        <DropdownMenuCheckboxItem
                            key={column.key}
                            checked={visible}
                            disabled={
                                column.hideable === false ||
                                (visible && table.visibleColumns.length === 1)
                            }
                            closeOnClick={false}
                            onCheckedChange={() => table.toggleColumn(column.key)}
                        >
                            {column.icon}
                            {column.header}
                        </DropdownMenuCheckboxItem>
                    )
                })}
            </DropdownMenuGroup>
        ),
        <DropdownMenuItem key="reset" onClick={table.resetView}>
            {t.resetView}
        </DropdownMenuItem>,
    ].filter((section): section is ReactElement => section !== false)
    const content = (
        <>
            {sections.map((section, index) => (
                <Fragment key={section.key}>
                    {index > 0 && <DropdownMenuSeparator />}
                    {section}
                </Fragment>
            ))}
            {children && (
                <>
                    <DropdownMenuSeparator />
                    {children}
                </>
            )}
        </>
    )
    if (inMenu)
        return (
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    <Columns3 />
                    {t.view}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="dt-view-menu min-w-[220px]">
                    {content}
                </DropdownMenuSubContent>
            </DropdownMenuSub>
        )
    return (
        <DropdownMenu>
            <DataTableAction
                label={t.view}
                icon={<Columns3 />}
                data-dt-tool
                render={<DropdownMenuTrigger />}
            />
            <DropdownMenuContent align="end" className="dt-view-menu min-w-[220px]">
                {content}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export function DataTableSelection<T>({
    table,
    children,
    showWhenEmpty = false,
}: {
    table: DataTableController<T>
    children?: ReactNode
    showWhenEmpty?: boolean
}) {
    const t = useMessages()
    const format = useFormat()
    if (!table.selection.size && !showWhenEmpty) return null
    const count = table.selection.size
    const selected = t.components.dataTable.selected(count, format.number(count))
    return (
        <div className="dt-selection ml-auto flex flex-nowrap items-center justify-end gap-1.5 has-[.dt-responsive-actions]:w-0 has-[.dt-responsive-actions]:min-w-min has-[.dt-responsive-actions]:flex-auto">
            {table.selection.size > 0 && (
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <span
                                className="dt-selection-count text-xs font-[550] whitespace-nowrap @max-[600px]/table:min-w-[22px] @max-[600px]/table:text-center"
                                role="status"
                                aria-label={selected}
                            />
                        }
                    >
                        <span aria-hidden="true" className="hidden @max-[600px]/table:inline">
                            {format.number(count)}
                        </span>
                        <span className="dt-toolbar-label leading-[18px] @max-[600px]/table:hidden">
                            {selected}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>
                        {selected}
                    </TooltipContent>
                </Tooltip>
            )}
            {children}
        </div>
    )
}
