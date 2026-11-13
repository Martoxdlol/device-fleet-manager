import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { GripVertical } from 'lucide-react'

/** How close to the viewport's edge, in pixels, a drag scrolls it, and how fast at the edge. */
const EDGE = 48
const SPEED = 14

type Drag = {
    pointer: number
    from: number
    target: number
    x: number
    y: number
    viewport: HTMLElement
    line: HTMLDivElement
    frame: number
    source: HTMLElement | null
}

/**
 * The handle of a table row that keeps a manual order: a drag by mouse, touch or pen moves the
 * row to where it is dropped among the rows drawn, the table scrolling near its edges, and the
 * arrow keys move it one place. `ids` are the rows in their order; `onMove` gets the moved row
 * and the row whose place it takes, as an array move does.
 */
export function RowReorderHandle({
    id,
    ids,
    label,
    disabled = false,
    onMove,
}: {
    id: string
    ids: readonly string[]
    label: string
    disabled?: boolean
    onMove: (active: string, over: string) => void
}) {
    const drag = useRef<Drag | null>(null)
    useEffect(
        () => () => {
            const state = drag.current
            if (!state) return
            cancelAnimationFrame(state.frame)
            state.line.remove()
        },
        [],
    )
    const rowAt = (state: Drag) => {
        const hit = document
            .elementFromPoint(state.x, state.y)
            ?.closest<HTMLElement>('[data-row-index]')
        if (hit && state.viewport.contains(hit)) return hit
        return null
    }
    const place = (state: Drag) => {
        const row = rowAt(state)
        const bounds = state.viewport.getBoundingClientRect()
        if (row) state.target = Number(row.dataset.rowIndex)
        else if (state.y > bounds.bottom - EDGE) state.target = ids.length - 1
        const target =
            row ?? state.viewport.querySelector<HTMLElement>(`[data-row-index="${state.target}"]`)
        if (!target || state.target === state.from) {
            state.line.style.display = 'none'
            return
        }
        const rect = target.getBoundingClientRect()
        state.line.style.display = 'block'
        state.line.style.left = `${bounds.left}px`
        state.line.style.width = `${bounds.width}px`
        state.line.style.top = `${(state.target > state.from ? rect.bottom : rect.top) - 1}px`
    }
    const tick = () => {
        const state = drag.current
        if (!state) return
        const bounds = state.viewport.getBoundingClientRect()
        const step =
            state.y < bounds.top + EDGE
                ? -SPEED * Math.min(1, (bounds.top + EDGE - state.y) / EDGE)
                : state.y > bounds.bottom - EDGE
                  ? SPEED * Math.min(1, (state.y - bounds.bottom + EDGE) / EDGE)
                  : 0
        if (step) {
            state.viewport.scrollTop += step
            place(state)
        }
        state.frame = requestAnimationFrame(tick)
    }
    const finish = (move: boolean) => {
        const state = drag.current
        if (!state) return
        drag.current = null
        cancelAnimationFrame(state.frame)
        state.line.remove()
        delete state.source?.dataset.dragging
        const over = ids[state.target]
        if (move && over !== undefined && state.target !== state.from) onMove(id, over)
    }
    const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        if (disabled || event.button !== 0) return
        const viewport = event.currentTarget.closest<HTMLElement>('.dt-viewport')
        const from = ids.indexOf(id)
        if (!viewport || from < 0) return
        event.preventDefault()
        event.stopPropagation()
        // Focus keeps its row drawn while the table scrolls it out of view.
        event.currentTarget.focus({ preventScroll: true })
        event.currentTarget.setPointerCapture(event.pointerId)
        const line = document.createElement('div')
        line.className = 'pointer-events-none fixed z-50 h-0.5 bg-primary'
        line.style.display = 'none'
        document.body.append(line)
        const source = event.currentTarget.closest<HTMLElement>('[data-row-index]')
        if (source) source.dataset.dragging = 'true'
        drag.current = {
            pointer: event.pointerId,
            from,
            target: from,
            x: event.clientX,
            y: event.clientY,
            viewport,
            line,
            frame: requestAnimationFrame(tick),
            source,
        }
    }
    const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
        const state = drag.current
        if (!state || state.pointer !== event.pointerId) return
        state.x = event.clientX
        state.y = event.clientY
        place(state)
    }
    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
        if (!step || disabled) return
        event.preventDefault()
        event.stopPropagation()
        const over = ids[ids.indexOf(id) + step]
        if (over !== undefined) onMove(id, over)
    }
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            className="grid h-8 w-5 shrink-0 cursor-grab touch-none place-items-center text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-default disabled:opacity-40 [&_svg]:size-3.5"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => finish(true)}
            onPointerCancel={() => finish(false)}
            onLostPointerCapture={() => finish(true)}
            onKeyDown={onKeyDown}
            onClick={(event) => event.stopPropagation()}
        >
            <GripVertical />
        </button>
    )
}
