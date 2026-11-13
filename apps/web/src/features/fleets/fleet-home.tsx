import { EmptyState } from '../../core/ui/primitives'
import { Icon } from '../../core/ui/icon'
import { useFleetScope } from '../../routing/route-context'
import { useMessages } from '../../i18n/provider'
import { FleetLayout } from './fleet-layout'

export function FleetHomePage() {
    const { fleet } = useFleetScope()
    const t = useMessages().fleets.home
    return (
        <FleetLayout key={fleet.id} view="overview">
            <EmptyState surface>
                <Icon name="layers" />
                <h2>{t.empty}</h2>
            </EmptyState>
        </FleetLayout>
    )
}
