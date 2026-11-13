import { useMemo, useContext, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { AppShell, type ShellConfig } from '../../core/layout/app-shell'
import { apple } from '../../lib/platform'
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
    const navigation = useMemo<NavItem[]>(
        () => [
            {
                id: 'home',
                label: t.components.navigation.home,
                icon: 'home',
                href: '/',
                active: location.pathname === '/',
            },
        ],
        [t, location.pathname],
    )
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
