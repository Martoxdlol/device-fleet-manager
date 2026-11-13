import type { ReactNode } from 'react'
import type { PageAction } from '../../core/layout/page-actions'
import { PageLayout } from '../../components/layout/page-layout'
import { SectionNavigation } from '../../components/layout/section-navigation'
import { PageContent } from '../../core/scaffold/scaffold'
import { EmptyState } from '../../core/ui/primitives'
import { organizationSettingsPath, type OrganizationSection } from '../../routing/paths'
import { useRouteScope } from '../../routing/route-context'
import { isOrgAdmin } from '../members/roles'
import { useMessages } from '../../i18n/provider'

type Section = 'general' | OrganizationSection

export function OrganizationSettingsLayout({
    section,
    actions,
    toolbar,
    fill = false,
    children,
}: {
    section: Section
    actions?: PageAction[]
    toolbar?: ReactNode
    fill?: boolean
    children: ReactNode
}) {
    const { org } = useRouteScope()
    const t = useMessages()
    const text = t.organizations.settings
    if (!isOrgAdmin(org.role))
        return (
            <PageLayout title={t.common.settings}>
                <PageContent>
                    <EmptyState surface>
                        <h2>{text.onlyAdmins}</h2>
                    </EmptyState>
                </PageContent>
            </PageLayout>
        )
    const sections = [
        {
            id: 'general',
            label: text.general,
            icon: 'building' as const,
            href: organizationSettingsPath(org),
        },
        {
            id: 'members',
            label: text.members,
            icon: 'users' as const,
            href: organizationSettingsPath(org, 'members'),
        },
        {
            id: 'invitations',
            label: text.invitations,
            icon: 'mail' as const,
            href: organizationSettingsPath(org, 'invitations'),
        },
        {
            id: 'groups',
            label: text.groups,
            icon: 'grid' as const,
            href: organizationSettingsPath(org, 'groups'),
        },
        {
            id: 'keys',
            label: text.keys,
            icon: 'key' as const,
            href: organizationSettingsPath(org, 'keys'),
        },
    ]
    return (
        <PageLayout
            title={text[section]}
            actions={actions}
            toolbar={toolbar}
            leftPanel={
                <SectionNavigation
                    title={t.common.settings}
                    sections={sections}
                    current={section}
                />
            }
        >
            <PageContent mode={fill ? 'fill' : 'scroll'} width={fill ? 'full' : 'settings'}>
                {children}
            </PageContent>
        </PageLayout>
    )
}
