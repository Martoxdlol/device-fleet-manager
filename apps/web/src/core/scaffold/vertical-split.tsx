import { cn } from 'cn'
import { useRef, type ReactNode } from 'react'
import { useShortcut } from '../keyboard/keyboard-context'
import { useStoredState } from '../storage/use-stored-state'
import { ResizeHandle, useResize } from '../resize'
import { useCover } from './cover-context'
import { useMobile } from './use-mobile'

const MIN_TOP = 120
const MIN_PANEL = 96
/** The least and the most of the height the panel takes, whatever the container's. */
const BOUNDS: [number, number] = [0.1, 0.9]

const parseFraction = (raw: unknown) =>
    typeof raw === 'number' && raw >= BOUNDS[0] && raw <= BOUNDS[1] ? raw : undefined

/**
 * A pane over a panel, such as code over its problems. The divider occupies the layout gap and
 * sizes the panel. A collapsed panel keeps its header only, below the gap, and the pane takes
 * the rest. On a phone an open panel covers the content area, as a stacked detail does, and
 * Escape collapses it.
 */
export function VerticalSplit({
    top,
    panel,
    collapsed,
    label,
    panelLabel,
    defaultFraction = 0.3,
    storageKey,
    onCollapse,
    className,
}: {
    top: ReactNode
    panel: ReactNode
    collapsed: boolean
    /** Names the divider, such as "Resize problems". */
    label: string
    /** Names the panel while it covers the content area. */
    panelLabel?: string
    /** Share of the height the panel takes until the user drags the divider. */
    defaultFraction?: number
    /** Remember the divider position per browser under this name. */
    storageKey?: string
    /** Collapses the panel, which Escape does while it covers the content area. */
    onCollapse?: () => void
    className?: string
}) {
    const mobile = useMobile()
    const covering = mobile && !collapsed
    useCover(covering)
    useShortcut(covering && onCollapse ? { key: 'Escape', late: true } : undefined, () =>
        onCollapse?.(),
    )
    const container = useRef<HTMLDivElement>(null)
    const [stored, setStored] = useStoredState(
        storageKey && `split.${storageKey}`,
        defaultFraction,
        parseFraction,
    )
    const resize = useResize({
        axis: 'y',
        pane: 'after',
        container,
        value: stored,
        min: BOUNDS[0],
        max: BOUNDS[1],
        reset: defaultFraction,
        onCommit: setStored,
        limits: () => {
            const height = container.current?.clientHeight
            if (!height) return {}
            return { min: MIN_PANEL / height, max: (height - MIN_TOP) / height }
        },
    })
    return (
        <div ref={container} className={cn('flex min-h-0 min-w-0 flex-col', className)}>
            <div className="flex min-h-0 flex-1 flex-col">{top}</div>
            {collapsed || covering ? (
                <div aria-hidden="true" className="h-(--space-gap) shrink-0" />
            ) : (
                <ResizeHandle
                    {...resize.props}
                    aria-label={label}
                    className="h-(--space-gap) shrink-0"
                />
            )}
            <div
                className={cn(
                    'flex min-h-0 flex-col',
                    covering &&
                        'fixed z-35 top-(--scaffold-fixed-top) right-(--scaffold-fixed-right) bottom-(--scaffold-fixed-bottom) left-(--scaffold-fixed-left) pt-[env(safe-area-inset-top)] pb-(--safe-area-bottom) [&>*]:rounded-none! [&>*]:shadow-none!',
                )}
                role={covering ? 'dialog' : undefined}
                aria-modal={covering ? true : undefined}
                aria-label={covering ? panelLabel : undefined}
                style={
                    covering
                        ? undefined
                        : collapsed
                          ? { flex: '0 0 auto' }
                          : { flex: `0 1 ${(resize.value * 100).toFixed(2)}%` }
                }
            >
                {panel}
            </div>
        </div>
    )
}
