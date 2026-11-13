import { useLocation } from 'react-router'
import { useAccount } from '../auth/auth-context'
import { AppNavigate } from '../auth/app-link'
import { OrganizationsPage } from '../features/organizations/organizations-page'
import { organizationPath } from '../routing/paths'

type ListState = { list?: boolean } | null

export function HomePage() {
    const { lastOrgSlug } = useAccount()
    const listed = (useLocation().state as ListState)?.list === true
    if (lastOrgSlug && !listed)
        return <AppNavigate to={organizationPath({ slug: lastOrgSlug })} replace />
    return <OrganizationsPage listed={listed} />
}
