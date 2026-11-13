import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'

const KEY_STEP = 24

interface Limits {
    /** Pixels per unit of the size. */
    scale: number
    min: number
    max: number
}

export interface ResizeOptions {
    axis: 'x' | 'y'
    /** Where the pane the handle sizes sits: before the handle, left or above, or after it. */
    pane: 'before' | 'after'
    /** The committed size: pixels, or a share of `container` when one is given. */
    value: number
    /** The least and the most the size may ever be. */
    min: number
    max: number
    /** Where a double click on the handle returns the size. */
    reset: number
    /** Called once a drag ends, on each arrow key and on a double click. */
    onCommit: (value: number) => void
    /** Makes the size a share of this element's length along `axis`. */
    container?: RefObject<HTMLElement | null>
    /** Narrows `min` and `max` to what the layout allows now, read when a drag or key press starts. */
    limits?: () => { min?: number; max?: number }
}

/**
 * Sizes a pane from a handle beside it: dragged, moved with the arrow keys, or reset with a
 * double click. The size follows the pointer while a drag lasts and is committed when it ends.
 * Moving the handle away from the pane grows it. When `limits` leave no room, `min` wins.
 */
export function useResize({
    axis,
    pane,
    value,
    min,
    max,
    reset,
    onCommit,
    container,
    limits,
}: ResizeOptions) {
    const [dragged, setDragged] = useState<number | null>(null)
    const drag = useRef<{ at: number; start: number; limits: Limits; now: number } | null>(null)
    const share = container !== undefined
    const measure = (): Limits => {
        const element = container?.current
        const length = element ? (axis === 'x' ? element.clientWidth : element.clientHeight) : 0
        const narrowed = limits?.() ?? {}
        const least = Math.max(min, narrowed.min ?? min)
        return {
            scale: share ? length : 1,
            min: least,
            max: Math.max(least, Math.min(max, narrowed.max ?? max)),
        }
    }
    const fit = (next: number, { min, max }: Limits) => {
        const clamped = Math.min(max, Math.max(min, next))
        return share ? clamped : Math.round(clamped)
    }
    const at = (event: PointerEvent) => (axis === 'x' ? event.clientX : event.clientY)
    const direction = pane === 'before' ? 1 : -1
    const keys = axis === 'x' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']
    const [shrink, grow] = pane === 'before' ? keys : [keys[1], keys[0]]
    const end = () => {
        const now = drag.current?.now
        drag.current = null
        setDragged(null)
        if (now !== undefined) onCommit(now)
    }
    const current = dragged ?? value
    const aria = (raw: number) => (share ? Math.round(raw * 100) : Math.round(raw))
    return {
        /** The size to render: the dragged one while a drag lasts, the committed one otherwise. */
        value: current,
        props: {
            role: 'separator',
            'aria-orientation': axis === 'x' ? 'vertical' : 'horizontal',
            'aria-valuenow': aria(current),
            'aria-valuemin': aria(min),
            'aria-valuemax': aria(max),
            tabIndex: 0,
            'data-dragging': dragged !== null || undefined,
            onPointerDown: (event: PointerEvent<HTMLElement>) => {
                if (event.button !== 0) return
                const limits = measure()
                if (!limits.scale) return
                event.preventDefault()
                const start = fit(value, limits)
                drag.current = { at: at(event), start, limits, now: start }
                setDragged(start)
                event.currentTarget.setPointerCapture(event.pointerId)
            },
            onPointerMove: (event: PointerEvent<HTMLElement>) => {
                const state = drag.current
                if (!state) return
                const delta = (direction * (at(event) - state.at)) / state.limits.scale
                state.now = fit(state.start + delta, state.limits)
                setDragged(state.now)
            },
            onPointerUp: (event: PointerEvent<HTMLElement>) => {
                end()
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId)
            },
            onLostPointerCapture: end,
            onDoubleClick: () => onCommit(fit(reset, measure())),
            onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                if (event.key !== grow && event.key !== shrink) return
                event.preventDefault()
                const limits = measure()
                if (!limits.scale) return
                const step = KEY_STEP / limits.scale
                onCommit(fit(fit(value, limits) + (event.key === grow ? step : -step), limits))
            },
        } as const,
    }
}
