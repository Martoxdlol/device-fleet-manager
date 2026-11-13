import type { ReactNode } from 'react'
import type { PageAction } from '../../core/layout/page-actions'
import { PageLayout } from '../../components/layout/page-layout'
import { PageContent } from '../../core/scaffold/scaffold'
import { fleetPath, fleetSettingsPath, organizationPath } from '../../routing/paths'
import { useFleetScope } from '../../routing/route-context'
import { useMessages } from '../../i18n/provider'
import { FleetSwitcher } from './fleet-switcher'

export type FleetView = 'overview' | 'settings'

export function FleetLayout({
    view,
    actions,
    left,
    fill = false,
    width = 'full',
    children,
}: {
    view: FleetView
    actions?: PageAction[]
    left?: ReactNode
    fill?: boolean
    width?: 'full' | 'settings'
    children: ReactNode
}) {
    const { org, fleet } = useFleetScope()
    const t = useMessages()
    return (
        <PageLayout
            title={fleet.name}
            titleContent={<FleetSwitcher view={view} />}
            back={{ href: organizationPath(org), label: t.fleets.switcher.all }}
            navigation={[
                {
                    id: 'overview',
                    label: t.fleets.views.overview,
                    icon: 'home',
                    href: fleetPath(org, fleet),
                    active: view === 'overview',
                },
                ...(fleet.access === 'admin'
                    ? [
                          {
                              id: 'settings',
                              label: t.common.settings,
                              icon: 'settings' as const,
                              href: fleetSettingsPath(org, fleet),
                              active: view === 'settings',
                          },
                      ]
                    : []),
            ]}
            actions={actions}
            leftPanel={left}
        >
            <PageContent mode={fill ? 'fill' : 'scroll'} width={width}>
                {children}
            </PageContent>
        </PageLayout>
    )
}
