import type { ReactNode } from 'react'
import { RailNavigation, type NavItem } from './navigation'
import { useBoundary } from '../boundary/boundary-context'

/** The column at the left edge on wide screens: what heads it, the navigation, and its footer. */
export function Rail({
    header,
    navigation,
    footer,
}: {
    header?: ReactNode
    navigation: NavItem[]
    footer?: ReactNode
}) {
    const Boundary = useBoundary()
    return (
        <aside className="w-(--space-railWidth) h-(--viewport-height) flex items-center flex-col gap-4 border-r bg-sidebar py-3 px-1.5">
            <Boundary name="rail">
                {header}
                <RailNavigation items={navigation} />
                <div className="flex flex-col items-center gap-1 mt-auto">{footer}</div>
            </Boundary>
        </aside>
    )
}
