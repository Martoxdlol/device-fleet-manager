import type { ReactNode } from 'react'
import type { PageAction } from '../../core/layout/page-actions'
import { SectionNavigation } from '../../components/layout/section-navigation'
import { EmptyState } from '../../core/ui/primitives'
import { fleetSettingsPath, type FleetSection } from '../../routing/paths'
import { useFleetScope } from '../../routing/route-context'
import { useMessages } from '../../i18n/provider'
import { FleetLayout } from './fleet-layout'

export function FleetSettingsLayout({
    section,
    actions,
    fill = false,
    children,
}: {
    section: 'general' | FleetSection
    actions?: PageAction[]
    fill?: boolean
    children: ReactNode
}) {
    const { org, fleet } = useFleetScope()
    const t = useMessages()
    const text = t.fleets.settings
    if (fleet.access !== 'admin')
        return (
            <FleetLayout view="settings">
                <EmptyState surface>
                    <h2>{text.onlyAdmins}</h2>
                </EmptyState>
            </FleetLayout>
        )
    return (
        <FleetLayout
            view="settings"
            actions={actions}
            fill={fill}
            width={fill ? 'full' : 'settings'}
            left={
                <SectionNavigation
                    title={t.common.settings}
                    current={section}
                    sections={[
                        {
                            id: 'general',
                            label: text.general,
                            icon: 'settings',
                            href: fleetSettingsPath(org, fleet),
                        },
                        {
                            id: 'access',
                            label: text.access,
                            icon: 'users',
                            href: fleetSettingsPath(org, fleet, 'access'),
                        },
                    ]}
                />
            }
        >
            {children}
        </FleetLayout>
    )
}
