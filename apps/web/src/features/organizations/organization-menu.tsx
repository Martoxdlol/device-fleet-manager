import { useContext, useState } from 'react'
import { useMatch } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import type { MyOrganization } from '@fleet/client'
import { useAuth } from '../../auth/auth-context'
import { useAppNavigate } from '../../auth/navigation'
import { useCanCreateOrganization } from '../../auth/instance'
import { Brand } from '../../components/layout/brand'
import { OrgSwitcher } from '../../components/layout/org-switcher'
import { usePagedList } from '../../lib/api/pagination'
import { organizationPath, organizationSettingsPath } from '../../routing/paths'
import { rememberRoute } from '../../routing/resolution'
import { RouteScopeContext } from '../../routing/route-context'
import { isOrgAdmin } from '../members/roles'
import { useMessages } from '../../i18n/provider'
import { LeaveOrganizationDialog } from './leave-dialog'
import { NewOrganizationDialog } from './new-organization-dialog'
import { useOrganizations } from './queries'

export function OrganizationMenu({
    organization,
    variant,
}: {
    organization?: MyOrganization
    variant?: 'rail' | 'title' | 'row'
}) {
    const { api, setLastOrg } = useAuth()
    const cache = useQueryClient()
    const navigate = useAppNavigate()
    const canCreate = useCanCreateOrganization()
    const [dialog, setDialog] = useState<'leave' | 'new' | null>(null)
    const list = useOrganizations()
    const { rows, pagination } = usePagedList(list)
    const t = useMessages()
    const text = t.organizations
    return (
        <>
            <OrgSwitcher
                variant={variant}
                organization={
                    organization && { ...organization, role: text.roles[organization.role] }
                }
                organizations={{
                    items: rows,
                    loading: list.isPending,
                    error: list.isError && !list.data ? list.error : undefined,
                    onRetry: () => void list.refetch(),
                    pagination,
                }}
                getHref={organizationPath}
                onSelect={(org) => rememberRoute(api, cache, org)}
                links={
                    organization && isOrgAdmin(organization.role)
                        ? [
                              {
                                  id: 'general',
                                  label: text.settings.general,
                                  icon: 'building',
                                  href: organizationSettingsPath(organization),
                              },
                              {
                                  id: 'members',
                                  label: text.settings.members,
                                  icon: 'users',
                                  href: organizationSettingsPath(organization, 'members'),
                              },
                          ]
                        : []
                }
                actions={[
                    {
                        label: text.menu.all,
                        icon: 'grid',
                        onSelect: () => {
                            setLastOrg(null)
                            navigate('/')
                        },
                    },
                    ...(canCreate
                        ? [
                              {
                                  label: text.menu.new,
                                  icon: 'plus' as const,
                                  onSelect: () => setDialog('new'),
                              },
                          ]
                        : []),
                    ...(organization
                        ? [
                              {
                                  label: text.menu.leave(organization.name),
                                  icon: 'logout' as const,
                                  onSelect: () => setDialog('leave'),
                              },
                          ]
                        : []),
                ]}
            />
            {dialog === 'leave' && organization && (
                <LeaveOrganizationDialog
                    organization={organization}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog === 'new' && <NewOrganizationDialog onClose={() => setDialog(null)} />}
        </>
    )
}

export function OrganizationRail() {
    const organization = useContext(RouteScopeContext)?.org
    if (useMatch('/')) return <Brand />
    return <OrganizationMenu organization={organization} variant="rail" />
}

export function OrganizationRow() {
    const organization = useContext(RouteScopeContext)?.org
    if (useMatch('/')) return null
    return <OrganizationMenu organization={organization} variant="row" />
}
