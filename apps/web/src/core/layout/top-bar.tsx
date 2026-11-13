import { cn } from 'cn'
import type { ReactNode } from 'react'
import { Link } from '../link/link'
import { GlassIsland } from '../scaffold/glass-island'
import { useMobile } from '../scaffold/use-mobile'
import { buttonVariants } from '../ui/button'
import { Icon } from '../ui/icon'
import { Button, ChromeTip } from '../ui/primitives'
import type { PageAction } from './page-actions'
import { useLocale } from '../locale/locale-context'

/** Floating chrome rides in glass islands; the gaps between them stay click-through. */
const chromeBar = 'flex h-9 shrink-0 items-center gap-1 p-0.5'
const iconButton = 'icon-button size-8 p-0 shrink-0'

/**
 * The bar over the page: the title island, the command bar centered on wide screens, and the
 * action island. Each opener shows only when its handler is given.
 */
export function TopBar({
    title,
    titleContent,
    back,
    titleInContent,
    commandBar,
    toolbar,
    actions,
    navigationButton,
    onMoreActions,
    onOpenDetails,
}: {
    title: string
    /** Replaces the title, and with it the back link. */
    titleContent?: ReactNode
    back?: { href: string; label: string }
    /** The page shows its own title in its content on wide screens, so the title bar is mobile only. */
    titleInContent: boolean
    /** Centered in the top chrome on wide screens, ahead of the actions on mobile. */
    commandBar?: ReactNode
    /** Search and filters for the current list, in the action island ahead of the actions. */
    toolbar?: ReactNode
    actions: PageAction[]
    /** Opens the left panel's sheet on a phone, or hides and shows the panel beside the page. */
    navigationButton?: { label: string; onSelect: () => void }
    onMoreActions?: () => void
    onOpenDetails?: () => void
}) {
    const t = useLocale().messages
    const mobile = useMobile()
    return (
        <header
            className={cn(
                'p-(--space-gap) flex items-start justify-between gap-(--space-gap) flex-wrap max-md:pt-[max(var(--space-gap),env(safe-area-inset-top))]',
                commandBar &&
                    'app-max-md:flex-nowrap app-md:grid app-md:grid-cols-[minmax(max-content,1fr)_minmax(0,36rem)_minmax(max-content,1fr)]',
            )}
        >
            <GlassIsland
                className={cn(
                    chromeBar,
                    'min-w-0 shrink justify-self-start app-max-md:max-w-[calc(100cqw-190px)]',
                    titleInContent && 'app-md:invisible',
                )}
            >
                {back && !titleContent && (
                    <Link
                        className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                        to={back.href}
                        aria-label={back.label}
                    >
                        <Icon name="left" />
                    </Link>
                )}
                {navigationButton && (
                    <ChromeTip label={navigationButton.label} side="bottom">
                        <Button
                            variant="ghost"
                            className={iconButton}
                            aria-label={navigationButton.label}
                            onClick={navigationButton.onSelect}
                        >
                            <Icon name="panel" />
                        </Button>
                    </ChromeTip>
                )}
                {titleContent ?? (
                    <div className="min-w-0 px-1 [&_h1]:text-[13px] [&_h1]:font-medium [&_h1]:overflow-hidden [&_h1]:text-ellipsis [&_h1]:whitespace-nowrap [&>span]:block [&>span]:text-[10px] [&>span]:text-muted-foreground [&>span]:leading-[1.4]">
                        <h1>{title}</h1>
                    </div>
                )}
            </GlassIsland>
            {commandBar &&
                (mobile ? (
                    <div className="pointer-events-auto ml-auto flex h-9 shrink-0 items-center gap-1">
                        {commandBar}
                    </div>
                ) : (
                    <GlassIsland className={cn(chromeBar, 'min-w-0')}>{commandBar}</GlassIsland>
                ))}
            <GlassIsland
                className={cn(
                    chromeBar,
                    'min-w-0 justify-self-end [&>button]:shrink-0 empty:hidden [&_.search-field]:w-[clamp(120px,20cqw,260px)] [&_.search-field_input]:h-8 **:data-[slot=combobox-trigger]:h-8',
                    commandBar && 'app-max-md:shrink-0',
                )}
            >
                {toolbar}
                {actions.map((action) => (
                    <Button
                        key={action.id}
                        variant="ghost"
                        size={mobile ? 'icon' : 'default'}
                        disabled={action.disabled}
                        aria-label={action.label}
                        onClick={action.onSelect}
                    >
                        <Icon name={action.icon} />
                        {!mobile && action.label}
                    </Button>
                ))}
                {onMoreActions && (
                    <Button
                        variant="ghost"
                        className={iconButton}
                        aria-label={t.moreActions}
                        onClick={onMoreActions}
                    >
                        <Icon name="more" />
                    </Button>
                )}
                {onOpenDetails && (
                    <Button
                        variant="ghost"
                        className={iconButton}
                        aria-label={t.openDetailsPanel}
                        onClick={onOpenDetails}
                    >
                        <Icon name="inspector" />
                    </Button>
                )}
            </GlassIsland>
        </header>
    )
}
