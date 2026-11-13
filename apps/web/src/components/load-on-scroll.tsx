import { useEffect, useRef, type CSSProperties } from 'react'
import { Spinner } from '../core/ui/primitives'

export function LoadOnScroll({
    more,
    loading,
    onLoad,
    label,
    as: Tag = 'div',
    className,
    style,
}: {
    more: boolean
    loading: boolean
    onLoad: () => void
    label: string
    as?: 'div' | 'li'
    className?: string
    style?: CSSProperties
}) {
    const end = useRef<HTMLElement>(null)
    const load = useRef(onLoad)
    useEffect(() => {
        load.current = onLoad
    })
    useEffect(() => {
        const element = end.current
        if (!element || !more || loading) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) load.current()
            },
            { rootMargin: '200px 0px' },
        )
        observer.observe(element)
        return () => observer.disconnect()
    }, [more, loading])
    if (!more) return null
    return (
        <Tag
            ref={(element: HTMLElement | null) => {
                end.current = element
            }}
            className={`flex min-h-6 justify-center py-1 ${className ?? ''}`}
            style={style}
        >
            {loading && <Spinner label={label} className="[&>span:first-child]:size-3.5" />}
        </Tag>
    )
}
