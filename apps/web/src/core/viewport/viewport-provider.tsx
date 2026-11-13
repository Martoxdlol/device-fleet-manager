import { useEffect, useState, type ReactNode } from 'react'
import { ViewportContext } from './viewport-context'

function isTextField(element: Element | null): element is HTMLElement {
    return (
        element instanceof HTMLElement &&
        (element.isContentEditable || element.matches('input, textarea'))
    )
}

export function ViewportProvider({ children }: { children: ReactNode }) {
    const [keyboard, setKeyboard] = useState(false)
    useEffect(() => {
        const viewport = window.visualViewport
        if (!viewport) return
        const root = document.documentElement
        let width = 0
        let full = 0
        const measure = () => {
            const zoomed = viewport.scale !== 1
            const height = zoomed ? root.clientHeight : viewport.height
            const top = zoomed ? 0 : viewport.offsetTop
            if (root.clientWidth !== width) {
                width = root.clientWidth
                full = 0
            }
            full = Math.max(full, root.clientHeight)
            root.style.setProperty('--viewport-height', `${height}px`)
            root.style.setProperty('--viewport-top', `${top}px`)
            root.style.setProperty(
                '--viewport-bottom-inset',
                `${Math.max(0, root.clientHeight - top - height)}px`,
            )
            return full - Math.round(top + height)
        }
        const resize = () => {
            const covered = measure()
            const field = document.activeElement
            setKeyboard(isTextField(field) && covered > 0)
            if (isTextField(field)) field.scrollIntoView({ block: 'nearest' })
        }
        measure()
        viewport.addEventListener('resize', resize)
        viewport.addEventListener('scroll', measure)
        return () => {
            viewport.removeEventListener('resize', resize)
            viewport.removeEventListener('scroll', measure)
        }
    }, [])
    return <ViewportContext value={{ keyboard }}>{children}</ViewportContext>
}
