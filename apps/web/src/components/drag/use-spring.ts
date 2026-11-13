import { useEffect, useRef, useState, type DragEvent } from 'react'
import { SILENCE, SPRING_DELAY } from './drag-model'

export function useSpring(type: string, onSpring?: () => void) {
    const [over, setOver] = useState(false)
    const seen = useRef(0)
    const latest = useRef(onSpring)
    useEffect(() => {
        latest.current = onSpring
    })
    const armed = over && !!onSpring
    useEffect(() => {
        if (!armed) return
        const timer = setInterval(() => {
            if (performance.now() - seen.current > SILENCE) setOver(false)
            else latest.current?.()
        }, SPRING_DELAY)
        return () => clearInterval(timer)
    }, [armed])
    const hover = (event: DragEvent) => {
        if (!onSpring || !event.dataTransfer.types.includes(type)) return
        seen.current = performance.now()
        setOver(true)
    }
    return {
        over: armed,
        props: {
            onDragEnter: hover,
            onDragOver: hover,
            onDragLeave: (event: DragEvent) => {
                if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null))
                    setOver(false)
            },
        },
    }
}
