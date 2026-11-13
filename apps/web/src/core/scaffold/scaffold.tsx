import { cn } from 'cn'
import { ScaffoldContext } from './scaffold-context'
import { CoverContext } from './cover-context'
import {
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
    type RefObject,
} from 'react'
import { getInsets, sides, type Sizes, type SlotId } from './geometry'
import { ResizeHandle, useResize } from '../resize'
const slotClasses: Partial<Record<SlotId, string>> = {
    'fixed-left': 'inset-y-0 z-40 left-0',
    'fixed-right': 'inset-y-0 z-40 right-0',
    'fixed-top': 'left-(--scaffold-fixed-left) right-(--scaffold-fixed-right) z-40 top-0',
    'fixed-bottom': 'left-(--scaffold-fixed-left) right-(--scaffold-fixed-right) z-40 bottom-0',
    'floating-top':
        'left-(--scaffold-fixed-left) right-(--scaffold-fixed-right) z-30 pointer-events-none top-(--scaffold-fixed-top)',
    'floating-bottom':
        'left-(--scaffold-fixed-left) right-(--scaffold-fixed-right) z-30 pointer-events-none bottom-(--scaffold-fixed-bottom)',
}

type Slots = Partial<Record<(typeof sides)[number], ReactNode>>
function MeasuredSlot({
    id,
    onSize,
    children,
}: {
    id: SlotId
    onSize: (id: SlotId, width: number, height: number) => void
    children: ReactNode
}) {
    const ref = useRef<HTMLDivElement>(null)
    useLayoutEffect(() => {
        const el = ref.current!
        const report = () => onSize(id, el.offsetWidth, el.offsetHeight)
        report()
        const observer = new ResizeObserver(report)
        observer.observe(el)
        return () => {
            observer.disconnect()
            onSize(id, 0, 0)
        }
    }, [id, onSize])
    return (
        <div
            ref={ref}
            className={`scaffold-slot fixed ${id} ${slotClasses[id]}`}
            data-scaffold-slot={id}
        >
            {children}
        </div>
    )
}

export interface SideSize {
    width: number
    min: number
    max: number
    reset: number
    onResize: (width: number) => void
    label: string
}

function ResizableSide({
    side,
    size,
    main,
    mainMin,
    hidden,
    children,
}: {
    side: 'left' | 'right'
    size: SideSize
    main: RefObject<HTMLDivElement | null>
    mainMin: number
    hidden?: boolean
    children: ReactNode
}) {
    const self = useRef<HTMLDivElement>(null)
    const resize = useResize({
        axis: 'x',
        pane: side === 'left' ? 'before' : 'after',
        value: size.width,
        min: size.min,
        max: size.max,
        reset: size.reset,
        onCommit: size.onResize,
        limits: () => ({
            max: (self.current?.offsetWidth ?? 0) + (main.current?.offsetWidth ?? 0) - mainMin,
        }),
    })
    return (
        <div
            ref={self}
            data-scaffold-slot={`floating-${side}`}
            className={cn('relative min-h-0', hidden && 'hidden')}
            style={{ flex: `0 1 ${resize.value}px`, minWidth: size.min }}
        >
            {children}
            <ResizeHandle
                {...resize.props}
                aria-label={size.label}
                className={cn(
                    'absolute inset-y-0 w-(--space-gap)',
                    side === 'left' ? 'left-full' : 'right-full',
                )}
            />
        </div>
    )
}

export function Scaffold({
    fixed = {},
    floating = {},
    resizable = {},
    hidden = {},
    mainMin = 0,
    children,
}: {
    fixed?: Slots
    floating?: Slots
    resizable?: Partial<Record<'left' | 'right', SideSize>>
    hidden?: Partial<Record<'left' | 'right', boolean>>
    mainMin?: number
    children: ReactNode
}) {
    const [sizes, setSizes] = useState<Sizes>({})
    const onSize = useCallback((id: SlotId, width: number, height: number) => {
        setSizes((old) =>
            old[id]?.width === width && old[id]?.height === height
                ? old
                : { ...old, [id]: { width, height } },
        )
    }, [])
    const [covers, setCovers] = useState<string[]>([])
    const setCover = useCallback((id: string, active: boolean) => {
        setCovers((old) =>
            active ? (old.includes(id) ? old : [...old, id]) : old.filter((entry) => entry !== id),
        )
    }, [])
    const covered = covers.length > 0
    const main = useRef<HTMLDivElement>(null)
    const sidePanel = (key: 'left' | 'right') => {
        const content = floating[key]
        if (!content) return null
        const size = resizable[key]
        return size ? (
            <ResizableSide
                side={key}
                size={size}
                main={main}
                mainMin={mainMin}
                hidden={hidden[key]}
            >
                {content}
            </ResizableSide>
        ) : (
            <div
                data-scaffold-slot={`floating-${key}`}
                className={cn('min-h-0 shrink-0', hidden[key] && 'hidden')}
            >
                {content}
            </div>
        )
    }
    const insets = getInsets(sizes)
    const vars = Object.fromEntries(
        Object.entries(insets).flatMap(([kind, values]) =>
            sides.map((side) => [`--scaffold-${kind}-${side}`, `${values[side]}px`]),
        ),
    ) as CSSProperties
    return (
        <ScaffoldContext value={insets}>
            <CoverContext value={{ covered, setCover }}>
                <div
                    className="scaffold isolate min-h-(--viewport-height) bg-background"
                    style={vars}
                >
                    {(['fixed', 'floating'] as const).flatMap((kind) =>
                        sides.map((side) => {
                            if (kind === 'floating' && (side === 'left' || side === 'right'))
                                return null
                            const child =
                                covered && kind === 'floating'
                                    ? null
                                    : (kind === 'fixed' ? fixed : floating)[side]
                            return child ? (
                                <MeasuredSlot
                                    key={`${kind}-${side}`}
                                    id={`${kind}-${side}`}
                                    onSize={onSize}
                                >
                                    {child}
                                </MeasuredSlot>
                            ) : null
                        }),
                    )}
                    <div
                        data-scaffold-body
                        className="fixed top-(--scaffold-content-top) right-(--scaffold-content-right) bottom-(--scaffold-content-bottom) left-(--scaffold-content-left) flex min-h-0 gap-(--space-gap) px-(--space-gap) pb-(--space-gap)"
                    >
                        {sidePanel('left')}
                        <div
                            ref={main}
                            data-scaffold-main
                            className="flex min-h-0 min-w-0 flex-1 flex-col"
                            style={mainMin ? { minWidth: `min(${mainMin}px, 100%)` } : undefined}
                        >
                            {children}
                        </div>
                        {sidePanel('right')}
                    </div>
                </div>
            </CoverContext>
        </ScaffoldContext>
    )
}
export function PageContent({
    mode = 'scroll',
    width = 'full',
    children,
    className,
}: {
    mode?: 'scroll' | 'fill'
    width?: 'full' | 'directory' | 'settings'
    children: ReactNode
    className?: string
}) {
    return (
        <main
            id="main-content"
            tabIndex={-1}
            data-page-scroll={mode === 'scroll' ? 'page' : 'content'}
            className={cn(
                'flex min-h-0 min-w-0 flex-1 flex-col outline-none',
                mode === 'scroll' ? 'overflow-auto overscroll-contain [scrollbar-width:thin]' : '',
                className,
            )}
        >
            <div
                data-page-body
                className={cn(
                    'min-w-0 w-full',
                    mode === 'scroll' ? 'shrink-0' : 'flex min-h-0 flex-1 flex-col',
                    width === 'directory' && 'mx-auto max-w-280',
                    width === 'settings' && 'mx-auto max-w-250',
                )}
            >
                {children}
            </div>
        </main>
    )
}
