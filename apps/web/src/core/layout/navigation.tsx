import { Link } from '../link/link'
import { GlassIsland } from '../scaffold/glass-island'
import { Button } from '../ui/primitives'
import { Icon, type IconName } from '../ui/icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { useLocale } from '../locale/locale-context'

export interface NavItem {
    id: string
    label: string
    icon: IconName
    href: string
    active?: boolean
}
export function RailNavigation({ items }: { items: NavItem[] }) {
    const t = useLocale().messages
    return (
        <nav
            aria-label={t.primaryNavigation}
            className="rail-links flex flex-col items-center gap-1 [&_a]:size-9 [&_a]:grid [&_a]:place-items-center [&_a]:text-muted-foreground [&_a]:transition-colors [&_a:hover]:bg-sidebar-accent/60 [&_a:hover]:text-sidebar-foreground [&_a[aria-current]]:bg-sidebar-accent [&_a[aria-current]]:text-sidebar-accent-foreground"
        >
            {items.map((item) => (
                <Tooltip key={item.id}>
                    <TooltipTrigger
                        render={
                            <Link
                                to={item.href}
                                aria-label={item.label}
                                aria-current={item.active ? 'page' : undefined}
                            />
                        }
                    >
                        <Icon name={item.icon} />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                    </TooltipContent>
                </Tooltip>
            ))}
        </nav>
    )
}
export function BottomNavigation({ items, onMore }: { items: NavItem[]; onMore: () => void }) {
    const t = useLocale().messages
    return (
        <div className="flex justify-center p-[12px_12px_max(12px,var(--safe-area-bottom))]">
            <GlassIsland className="flex max-w-full gap-1 p-1.5">
                <nav
                    aria-label={t.mobileNavigation}
                    className="bottom-links flex gap-1 [&_a]:grid [&_a]:place-items-center [&_a]:size-10 [&_a]:text-muted-foreground [&_a]:transition-colors [&_a:hover]:text-foreground [&_a[aria-current]]:bg-accent/60 [&_a[aria-current]]:text-accent-foreground"
                >
                    {items.map((item) => (
                        <Link
                            key={item.id}
                            to={item.href}
                            aria-label={item.label}
                            aria-current={item.active ? 'page' : undefined}
                        >
                            <Icon name={item.icon} />
                        </Link>
                    ))}
                </nav>
                <Button
                    variant="ghost"
                    className="more-tab grid size-10 place-items-center p-0 text-muted-foreground"
                    aria-label={t.moreNavigation}
                    onClick={onMore}
                >
                    <Icon name="up" />
                </Button>
            </GlassIsland>
        </div>
    )
}
