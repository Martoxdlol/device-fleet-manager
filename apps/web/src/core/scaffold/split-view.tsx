import { PanelHeader, PanelTitle, PanelActions, PanelAction } from '../layout/panel'
import { cn } from 'cn'
import { useRef, type ReactNode } from 'react'
import { useShortcut } from '../keyboard/keyboard-context'
import { useStackedPanels } from './use-mobile'
import { useStoredState } from '../storage/use-stored-state'
import { useCover } from './cover-context'
import { Icon } from '../ui/icon'
import { surfaceClasses } from '../ui/surface'
import { ResizeHandle, useResize } from '../resize'
import { useLocale } from '../locale/locale-context'

const MIN_LIST = 240
const MIN_DETAIL = 320

export function SplitDetailHeader({
    title,
    onClose,
    actions,
}: {
    title: string
    onClose: () => void
    actions?: ReactNode
}) {
    const t = useLocale().messages
    return (
        <PanelHeader className="split-detail-header">
            <PanelTitle>{title}</PanelTitle>
            {actions && <PanelActions>{actions}</PanelActions>}
            <PanelAction iconOnly aria-label={t.close} onClick={onClose}>
                <Icon name="close" />
            </PanelAction>
        </PanelHeader>
    )
}

const BOUNDS: [number, number] = [0.2, 0.8]

const parseFraction = (raw: unknown) =>
    typeof raw === 'number' && raw >= BOUNDS[0] && raw <= BOUNDS[1] ? raw : undefined

export function SplitView({
    list,
    detail,
    detailTitle,
    detailHeader = true,
    detailActions,
    emptyDetail,
    listHidden = false,
    active = true,
    defaultDetailFraction = 0.5,
    storageKey,
    onClose,
}: {
    list: ReactNode
    detail: ReactNode | null
    detailTitle: string
    detailHeader?: boolean
    detailActions?: ReactNode
    emptyDetail?: ReactNode
    listHidden?: boolean
    active?: boolean
    defaultDetailFraction?: number
    storageKey?: string
    onClose: () => void
}) {
    const t = useLocale().messages
    const selected = detail != null
    const narrow = useStackedPanels()
    const open = selected || (emptyDetail != null && !narrow)
    const stacked = narrow && selected && !listHidden
    useCover(stacked && active)
    const container = useRef<HTMLDivElement>(null)
    const [stored, setStored] = useStoredState(
        storageKey && `split.${storageKey}`,
        defaultDetailFraction,
        parseFraction,
    )
    const resize = useResize({
        axis: 'x',
        pane: 'after',
        container,
        value: stored,
        min: BOUNDS[0],
        max: BOUNDS[1],
        reset: defaultDetailFraction,
        onCommit: setStored,
        limits: () => {
            const element = container.current
            const width = element?.clientWidth
            if (!element || !width) return {}
            return { min: MIN_DETAIL / width, max: (width - MIN_LIST - gapOf(element)) / width }
        },
    })
    const fraction = resize.value
    useShortcut(
        selected && active && !listHidden ? { key: 'Escape', late: true } : undefined,
        onClose,
    )
    return (
        <div
            ref={container}
            className={cn('split-view group/split flex min-h-0 flex-1', open && 'open')}
        >
            <div className={cn('min-h-0 min-w-0 flex-1', listHidden && 'hidden')}>{list}</div>
            {open && !stacked && !listHidden && (
                <ResizeHandle
                    {...resize.props}
                    aria-label={t.resizeDetails}
                    className="split-divider w-(--space-gap) shrink-0"
                />
            )}
            <section
                className={cn(
                    'split-detail min-h-0 min-w-0 flex-col overflow-hidden',
                    surfaceClasses,
                    open ? 'flex' : 'hidden',
                    stacked &&
                        'fixed z-35 top-(--scaffold-fixed-top) right-(--scaffold-fixed-right) bottom-(--scaffold-fixed-bottom) left-(--scaffold-fixed-left) rounded-none! shadow-none! pt-[env(safe-area-inset-top)]',
                )}
                style={
                    listHidden
                        ? { flex: '1 1 0' }
                        : open && !stacked
                          ? { flex: `0 1 ${(fraction * 100).toFixed(2)}%` }
                          : undefined
                }
                aria-label={detailTitle}
                role={stacked ? 'dialog' : undefined}
                aria-modal={stacked ? true : undefined}
            >
                {selected && detailHeader && (
                    <SplitDetailHeader
                        title={detailTitle}
                        onClose={onClose}
                        actions={detailActions}
                    />
                )}
                <div
                    className={cn(
                        'min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-width:thin] [&>.panel-content]:min-h-full',
                        stacked && 'pb-(--safe-area-bottom)',
                    )}
                >
                    {selected ? (
                        detail
                    ) : open ? (
                        <div className="grid h-full place-items-center p-6 text-center text-xs text-muted-foreground">
                            {emptyDetail}
                        </div>
                    ) : null}
                </div>
            </section>
        </div>
    )
}

function gapOf(element: HTMLElement) {
    const divider = element.querySelector<HTMLElement>('.split-divider')
    return divider ? divider.getBoundingClientRect().width : 0
}
