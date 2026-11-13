import { useContext, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { AppShell, type ShellConfig } from '../../core/layout/app-shell'
import { apple } from '../../lib/platform'
import { organizationPath, organizationSettingsPath } from '../../routing/paths'
import { RouteScopeContext } from '../../routing/route-context'
import { Brand } from './brand'
import { ChromeContext } from './chrome-context'
import type { NavItem } from '../../core/layout/navigation'
import { useMessages } from '../../i18n/provider'

const leftShortcut = {
    binding: apple
        ? { key: 'b', meta: true, inText: true }
        : { key: 'b', ctrl: true, inText: true },
    keys: apple ? '⌘B' : 'Ctrl+B',
}

export function PageLayout({
    children,
    ...props
}: Omit<ShellConfig, 'navigation'> & {
    navigation?: NavItem[]
    children: ReactNode
}) {
    const t = useMessages()
    const location = useLocation()
    const chrome = useContext(ChromeContext)
    const org = useContext(RouteScopeContext)?.org
    const current = location.pathname.toLowerCase()
    const settings = org && organizationSettingsPath(org)
    const inSettings =
        !!settings &&
        (current === settings.toLowerCase() || current.startsWith(`${settings.toLowerCase()}/`))
    const admin = org?.role === 'owner' || org?.role === 'admin'
    const navigation: NavItem[] = org
        ? [
              {
                  id: 'fleets',
                  label: t.components.navigation.fleets,
                  icon: 'layers',
                  href: organizationPath(org),
                  active: !inSettings,
              },
              ...(admin && settings
                  ? [
                        {
                            id: 'settings',
                            label: t.common.settings,
                            icon: 'settings' as const,
                            href: settings,
                            active: inSettings,
                        },
                    ]
                  : []),
          ]
        : [
              {
                  id: 'organizations',
                  label: t.components.navigation.organizations,
                  icon: 'building',
                  href: '/',
                  active: location.pathname === '/',
              },
          ]
    return (
        <AppShell
            navigation={navigation}
            leftShortcut={leftShortcut}
            {...chrome}
            {...props}
            railHeader={props.railHeader ?? chrome.railHeader ?? <Brand />}
        >
            {children}
        </AppShell>
    )
}
