import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { MOBILE_WIDTH, STACKED_WIDTH } from './use-mobile'
import { AppFrameContext, AppLayoutContext } from './app-frame-context'

export function AppFrame({ children }: { children: ReactNode }) {
    useEffect(() => {
        const pin = () => {
            if (window.visualViewport?.scale === 1 && (window.scrollX || window.scrollY)) {
                window.scrollTo(0, 0)
            }
        }
        window.addEventListener('scroll', pin)
        return () => window.removeEventListener('scroll', pin)
    }, [])
    const [area, setArea] = useState<HTMLElement | null>(null)
    const [column, setColumn] = useState<HTMLElement | null>(null)
    const [mobile, setMobile] = useState(() => window.innerWidth < MOBILE_WIDTH)
    const [stacked, setStacked] = useState(() => window.innerWidth < STACKED_WIDTH)
    useLayoutEffect(() => {
        if (!area) return
        const measure = () => {
            setMobile(area.clientWidth < MOBILE_WIDTH)
            setStacked(area.clientWidth < STACKED_WIDTH)
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(area)
        return () => observer.disconnect()
    }, [area])
    const frame = useMemo(() => ({ area, column }), [area, column])
    const layout = useMemo(() => ({ mobile, stacked }), [mobile, stacked])
    return (
        <AppFrameContext value={frame}>
            <AppLayoutContext value={layout}>
                <div className="fixed inset-0 flex bg-background">
                    <div
                        ref={setArea}
                        data-app-area
                        className="@container/app relative min-w-0 flex-1 contain-layout"
                    >
                        {children}
                    </div>
                    <div ref={setColumn} data-app-column className="flex shrink-0" />
                </div>
            </AppLayoutContext>
        </AppFrameContext>
    )
}
