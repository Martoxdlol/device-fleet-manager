import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { MOBILE_WIDTH, STACKED_WIDTH } from './use-mobile'
import { AppFrameContext, AppLayoutContext } from './app-frame-context'

/**
 * The viewport, split in two: the app area and a column beside it. The frame paints the app's
 * background behind both. A panel in the column, in flow, takes its width from the area, so the
 * whole app narrows the way a smaller screen would, without any page knowing about it.
 *
 * The area is the `app` container every layout answers to. Its layout containment makes it the
 * containing block of the scaffold's fixed slots, which a container query alone does not.
 *
 * While a frame is on the page the document never scrolls: the theme fixes the body to the visual
 * viewport, and only WebKit's reveal of a focused field moves it, which the frame puts back.
 */
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
    // Booleans, not the width: consumers render again only when the area crosses a threshold.
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
