import { cn } from 'cn'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronsUpDown } from 'lucide-react'
import { AppLink } from '../../auth/app-link'
import type { CursorPagination } from '../data-table/types'
import { Button } from '../../core/ui/button'
import { Icon, type IconName } from '../../core/ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '../../core/ui/popover'
import { Spinner } from '../../core/ui/primitives'
import { useMessages } from '../../i18n/provider'
import { OrgAvatar, type OrgLook } from './org-avatar'

type OrganizationOption = OrgLook & { id: string }

export interface OrgSwitcherLink {
    id: string
    label: string
    icon: IconName
    href: string
}
export interface OrgSwitcherAction {
    label: string
    icon: IconName
    onSelect: () => void
}
export interface OrgSwitcherOptions<T> {
    items: readonly T[]
    loading?: boolean
    error?: unknown
    onRetry?: () => void
    pagination?: CursorPagination
}

const row =
    'flex h-8 w-full shrink-0 items-center gap-2.5 px-2 text-left text-xs outline-none transition-colors hover:bg-muted focus-visible:bg-muted [&>svg]:size-5 [&>svg]:p-0.5 [&>svg]:shrink-0 [&>svg]:text-muted-foreground'
const rowHeight = 32

function OrganizationRows<T extends OrganizationOption>({
    items,
    getHref,
    onSelect,
    pagination,
    children,
}: {
    items: readonly T[]
    getHref?: (organization: T) => string
    onSelect: (organization: T) => void
    pagination?: CursorPagination
    children?: ReactNode
}) {
    'use no memo'
    const t = useMessages()
    const scrollRef = useRef<HTMLDivElement>(null)
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => rowHeight,
        overscan: 8,
    })
    const rows = virtualizer.getVirtualItems()
    const last = rows.at(-1)?.index ?? -1
    const fetchNext = () => pagination?.fetchNextPage().catch(() => undefined)
    useEffect(() => {
        if (
            pagination?.nextCursor != null &&
            !pagination.isFetchingNextPage &&
            !pagination.error &&
            last >= items.length - 10
        )
            void fetchNext()
    })
    return (
        <div
            ref={scrollRef}
            className="max-h-80 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
        >
            <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {rows.map((virtual) => {
                    const item = items[virtual.index]
                    const className = cn(row, 'absolute top-0 left-0')
                    const style = { transform: `translateY(${virtual.start}px)` }
                    const content = (
                        <>
                            <OrgAvatar organization={item} className="size-5 text-[9px]" />
                            <span className="truncate">{item.name}</span>
                        </>
                    )
                    return getHref ? (
                        <AppLink
                            key={item.id}
                            to={getHref(item)}
                            onClick={() => onSelect(item)}
                            className={className}
                            style={style}
                        >
                            {content}
                        </AppLink>
                    ) : (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelect(item)}
                            className={className}
                            style={style}
                        >
                            {content}
                        </button>
                    )
                })}
            </div>
            {pagination?.isFetchingNextPage && (
                <div className="flex justify-center py-1.5">
                    <Spinner label={t.components.orgSwitcher.loading} />
                </div>
            )}
            {!!pagination?.error && (
                <div
                    role="alert"
                    className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
                >
                    {t.components.orgSwitcher.moreFailed}
                    <Button size="xs" variant="ghost" onClick={() => void fetchNext()}>
                        {t.common.retryShort}
                    </Button>
                </div>
            )}
            {children}
        </div>
    )
}

export function OrgSwitcher<T extends OrganizationOption>({
    organization,
    organizations,
    getHref,
    onSelect,
    links = [],
    actions = [],
    variant = 'title',
}: {
    organization?: OrganizationOption & { role?: string }
    organizations: OrgSwitcherOptions<T>
    getHref?: (organization: T) => string
    onSelect: (organization: T) => void
    links?: OrgSwitcherLink[]
    actions?: OrgSwitcherAction[]
    variant?: 'rail' | 'title' | 'row'
}) {
    const t = useMessages()
    const text = t.components.orgSwitcher
    const [open, setOpen] = useState(false)
    const { items, loading, error, onRetry, pagination } = organizations
    const others = items.filter((item) => item.id !== organization?.id)
    const avatar = (className: string) =>
        organization ? (
            <OrgAvatar organization={organization} className={className} />
        ) : (
            <span
                className={cn(
                    'org-avatar inline-flex shrink-0 items-center justify-center bg-foreground text-background',
                    className,
                )}
            >
                <Icon name="building" />
            </span>
        )
    const name = organization?.name ?? text.organizations
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button
                        variant="ghost"
                        className={
                            variant === 'rail'
                                ? 'icon-button size-9 shrink-0 p-0'
                                : variant === 'row'
                                  ? 'account-row h-10.5 justify-start'
                                  : 'h-8 min-w-0 max-w-full gap-3 px-0.5 text-left'
                        }
                        aria-label={text.menuOf(name)}
                    />
                }
            >
                {variant === 'rail' ? (
                    avatar('size-8 text-[11px]')
                ) : variant === 'row' ? (
                    <>
                        {avatar('size-7 text-[10px]')}
                        <span className="truncate">{name}</span>
                    </>
                ) : (
                    <>
                        {avatar('size-6 text-[9px]')}
                        <h1 className="min-w-0 truncate text-[13px] font-semibold">{name}</h1>
                        <ChevronsUpDown
                            aria-hidden="true"
                            className="size-3.5 shrink-0 text-muted-foreground"
                        />
                    </>
                )}
            </PopoverTrigger>
            <PopoverContent
                side={variant === 'rail' ? 'right' : variant === 'row' ? 'top' : 'bottom'}
                sideOffset={variant === 'rail' ? 12 : 4}
                aria-label={text.menu}
                className="flex max-h-(--available-height) w-72 max-w-(--available-width) flex-col divide-y divide-border/50 p-1 [&>*]:py-1"
            >
                {organization && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                        <div className="flex items-center gap-3 px-2 py-1.5">
                            <OrgAvatar
                                organization={organization}
                                className="size-10 text-[13px]"
                            />
                            <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold">
                                    {organization.name}
                                </p>
                                {organization.role && (
                                    <p className="text-xs text-muted-foreground">
                                        {organization.role}
                                    </p>
                                )}
                            </div>
                        </div>
                        {!!links.length && (
                            <div
                                className={cn('grid gap-1 px-1', links.length > 1 && 'grid-cols-2')}
                            >
                                {links.map((link) => (
                                    <AppLink
                                        key={link.id}
                                        to={link.href}
                                        onClick={() => setOpen(false)}
                                        className="flex h-9 items-center gap-2 bg-muted/60 px-2.5 text-xs font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground"
                                    >
                                        <Icon name={link.icon} />
                                        {link.label}
                                    </AppLink>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {(!!others.length || !!error || (loading && !items.length)) && (
                    <div className="flex min-h-0 flex-col">
                        <OrganizationRows
                            items={others}
                            getHref={getHref}
                            onSelect={(item) => {
                                setOpen(false)
                                onSelect(item)
                            }}
                            pagination={pagination}
                        >
                            {loading && !items.length && (
                                <div className="flex justify-center py-2">
                                    <Spinner label={text.loading} />
                                </div>
                            )}
                            {!!error && (
                                <div
                                    role="alert"
                                    className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
                                >
                                    {text.failed}
                                    {onRetry && (
                                        <Button size="xs" variant="ghost" onClick={onRetry}>
                                            {t.common.retryShort}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </OrganizationRows>
                    </div>
                )}
                {!!actions.length && (
                    <div className="flex shrink-0 flex-col">
                        {actions.map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                className={row}
                                onClick={() => {
                                    setOpen(false)
                                    action.onSelect()
                                }}
                            >
                                <Icon name={action.icon} />
                                <span className="truncate">{action.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
