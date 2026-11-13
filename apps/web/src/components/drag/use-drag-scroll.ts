import { useEffect, useRef, type DragEvent, type RefObject } from 'react'
import { SILENCE } from './drag-model'

const EDGE = 52
const MAX_STEP = 18

export function useDragScroll(element: RefObject<HTMLElement | null>) {
    const speed = useRef(0)
    const frame = useRef(0)
    const seen = useRef(0)
    const stop = useRef(() => {
        speed.current = 0
        if (frame.current) cancelAnimationFrame(frame.current)
        frame.current = 0
    })
    useEffect(() => {
        const end = stop.current
        window.addEventListener('dragend', end)
        window.addEventListener('drop', end)
        return () => {
            end()
            window.removeEventListener('dragend', end)
            window.removeEventListener('drop', end)
        }
    }, [])
    return {
        onDragOverCapture: (event: DragEvent) => {
            const node = element.current
            if (!node) return
            seen.current = performance.now()
            const box = node.getBoundingClientRect()
            const top = event.clientY - box.top
            const bottom = box.bottom - event.clientY
            speed.current =
                top < EDGE
                    ? -Math.ceil(((EDGE - top) / EDGE) * MAX_STEP)
                    : bottom < EDGE
                      ? Math.ceil(((EDGE - bottom) / EDGE) * MAX_STEP)
                      : 0
            if (!speed.current || frame.current) return
            const tick = () => {
                const target = element.current
                if (!target || !speed.current || performance.now() - seen.current > SILENCE) {
                    frame.current = 0
                    return
                }
                target.scrollTop += speed.current
                frame.current = requestAnimationFrame(tick)
            }
            frame.current = requestAnimationFrame(tick)
        },
        onDragLeaveCapture: (event: DragEvent) => {
            if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null))
                stop.current()
        },
        onDropCapture: () => stop.current(),
    }
}
