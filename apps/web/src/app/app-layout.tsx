import { Outlet } from 'react-router'
import { useAccount } from '../auth/auth-context'
import { PresentationProvider } from '../components/feedback/presentation-provider'
import { AccountControls } from '../components/layout/account-controls'
import { BoundaryContext } from '../core/boundary/boundary-context'
import { ErrorBoundary } from '../components/feedback/error-boundary'
import { ChromeContext } from '../components/layout/chrome-context'
import { SpacingProvider } from '../core/scaffold/spacing'
import { AppFrame } from '../core/scaffold/app-frame'
import { OrganizationRail, OrganizationRow } from '../features/organizations/organization-menu'
import { CommandBar } from './command-bar'
import { ThemeProvider } from '../core/theme/theme-provider'

const chrome = {
    commandBar: <CommandBar />,
    railHeader: <OrganizationRail />,
    railFooter: <AccountControls />,
    mobileMenu: (
        <>
            <OrganizationRow />
            <div className="my-2" />
            <AccountControls expanded />
        </>
    ),
}

export function AppLayout() {
    const { user } = useAccount()
    return (
        <ThemeProvider>
            <SpacingProvider>
                <PresentationProvider key={user.id}>
                    <ChromeContext value={chrome}>
                        <BoundaryContext value={ErrorBoundary}>
                            <AppFrame>
                                <Outlet />
                            </AppFrame>
                        </BoundaryContext>
                    </ChromeContext>
                </PresentationProvider>
            </SpacingProvider>
        </ThemeProvider>
    )
}
