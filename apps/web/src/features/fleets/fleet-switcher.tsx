import { useQueryClient } from '@tanstack/react-query'
import type { VisibleFleet } from '@fleet/client'
import { useAuth } from '../../auth/auth-context'
import { useAppNavigate } from '../../auth/navigation'
import { Combobox } from '../../components/combobox'
import { Icon } from '../../core/ui/icon'
import { fleetPath, fleetSettingsPath, organizationPath } from '../../routing/paths'
import { rememberRoute } from '../../routing/resolution'
import { useFleetScope } from '../../routing/route-context'
import { useMessages } from '../../i18n/provider'
import { useFleetOptions } from './queries'
import type { FleetView } from './fleet-layout'

export function FleetSwitcher({ view }: { view: FleetView }) {
    const { org, fleet } = useFleetScope()
    const { api } = useAuth()
    const cache = useQueryClient()
    const data = useFleetOptions(org.id)
    const navigate = useAppNavigate()
    const t = useMessages().fleets.switcher
    return (
        <Combobox<VisibleFleet>
            {...data}
            value={fleet}
            getItemId={(item) => item.id}
            getItemLabel={(item) => item.name}
            label={t.label(fleet.name)}
            searchPlaceholder={t.search}
            className="min-w-0 max-w-full"
            triggerClassName="h-8 gap-3 border-transparent! bg-transparent! pl-1.5 pr-0.5 shadow-none! text-left"
            popupClassName="min-w-60"
            renderValue={(item) => (
                <h1 className="truncate text-[13px] font-semibold">{item?.name}</h1>
            )}
            renderItem={(item) => (
                <span className="flex min-w-0 items-center gap-2">
                    <Icon name="layers" />
                    <span className="truncate">{item.name}</span>
                </span>
            )}
            onValueChange={(item) => {
                if (!item || item.id === fleet.id) return
                rememberRoute(api, cache, org, item)
                navigate(
                    view === 'settings' && item.access === 'admin'
                        ? fleetSettingsPath(org, item)
                        : fleetPath(org, item),
                )
            }}
            actions={[
                {
                    label: t.all,
                    icon: <Icon name="grid" />,
                    onClick: () => navigate(organizationPath(org)),
                },
            ]}
        />
    )
}
