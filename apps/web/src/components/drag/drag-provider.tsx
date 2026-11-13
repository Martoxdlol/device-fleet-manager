import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { DragContext, type DragSession } from './drag-context'
import { SILENCE, fromComputer } from './drag-model'

/**
 * The running drag, held in a ref. `dataTransfer` is in protected mode until the drop, so a
 * target hovering a drag can read its types and nothing else: the payload has to live here.
 *
 * A drag can outlive its source: a spring that opens another folder unmounts the row it started
 * on, and `dragend` then fires on a detached node that never reaches React. The window still
 * sees every drop, so the session also ends there, once the targets have read it.
 *
 * The drag image is a snapshot taken when the drag starts, so it cannot follow the copy key.
 * Below it sits a label saying what dropping here would do, redrawn each frame from what the
 * target under the pointer reported during the last `dragover`, and hidden over a refusal.
 */
export function DragProvider({ children }: { children: ReactNode }) {
    const active = useRef<{ type: string; payload: unknown } | null>(null)
    const hint = useRef<string | null>(null)
    useEffect(() => {
        const label = document.createElement('div')
        label.className =
            'drag-hint pointer-events-none fixed top-0 left-0 z-50 hidden max-w-72 truncate border border-primary bg-card px-2.5 py-1.5 text-xs text-foreground shadow-lg'
        document.body.append(label)
        let frame = 0
        let silence = 0
        let at = { x: 0, y: 0 }
        const hide = () => label.classList.add('hidden')
        const draw = () => {
            frame = 0
            const current = hint.current
            if (!current) return hide()
            label.textContent = current
            label.style.transform = `translate(${at.x - 12}px, ${at.y + 24}px)`
            label.classList.remove('hidden')
        }
        const over = (event: DragEvent) => {
            hint.current = null
            at = { x: event.clientX, y: event.clientY }
            if (!frame) frame = requestAnimationFrame(draw)
            clearTimeout(silence)
            silence = window.setTimeout(hide, SILENCE)
        }
        const finish = () => {
            hint.current = null
            cancelAnimationFrame(frame)
            frame = 0
            hide()
        }
        const drop = () => {
            finish()
            setTimeout(() => (active.current = null))
        }
        // A file that reaches the window no target took: refused, so the tab never opens it.
        const stray = (event: DragEvent) => {
            if (!event.dataTransfer || !fromComputer(event.dataTransfer) || event.defaultPrevented)
                return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'none'
        }
        window.addEventListener('dragover', over, true)
        window.addEventListener('drop', drop, true)
        window.addEventListener('dragend', finish, true)
        window.addEventListener('dragover', stray)
        window.addEventListener('drop', stray)
        return () => {
            cancelAnimationFrame(frame)
            clearTimeout(silence)
            window.removeEventListener('dragover', over, true)
            window.removeEventListener('drop', drop, true)
            window.removeEventListener('dragend', finish, true)
            window.removeEventListener('dragover', stray)
            window.removeEventListener('drop', stray)
            label.remove()
        }
    }, [])
    const session = useMemo<DragSession>(
        () => ({
            begin: (type, payload) => {
                active.current = { type, payload }
            },
            end: () => {
                active.current = null
            },
            read: <T,>(channel: { type: string }) =>
                active.current?.type === channel.type ? (active.current.payload as T) : null,
            hint: (next) => {
                hint.current = next
            },
        }),
        [],
    )
    return <DragContext value={session}>{children}</DragContext>
}
