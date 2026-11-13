import { useEffect, useRef, type RefObject } from 'react'

const field = 'input, textarea, select, [contenteditable=true]'

/**
 * The browser's paste while focus is inside `area` and not in a field. Firefox sends a paste
 * outside a field to the body, so the focus, not the event's target, says where it belongs.
 */
export function useFocusPaste(
    area: RefObject<HTMLElement | null>,
    onPaste: ((event: ClipboardEvent) => void) | undefined,
) {
    const handler = useRef(onPaste)
    useEffect(() => {
        handler.current = onPaste
    })
    const listening = !!onPaste
    useEffect(() => {
        if (!listening) return
        const paste = (event: ClipboardEvent) => {
            const focus = document.activeElement
            if (!focus || !area.current?.contains(focus) || focus.closest(field)) return
            handler.current?.(event)
        }
        document.addEventListener('paste', paste)
        return () => document.removeEventListener('paste', paste)
    }, [area, listening])
}
