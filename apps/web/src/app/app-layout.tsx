import { Outlet } from 'react-router'
import { PresentationProvider } from '../components/feedback/presentation-provider'
import { ThemeToggle } from '../components/layout/theme-toggle'
import { BoundaryContext } from '../core/boundary/boundary-context'
import { ErrorBoundary } from '../components/feedback/error-boundary'
import { ChromeContext } from '../components/layout/chrome-context'
import { SpacingProvider } from '../core/scaffold/spacing'
import { AppFrame } from '../core/scaffold/app-frame'
import { CommandBar } from './command-bar'
import { ThemeProvider } from '../core/theme/theme-provider'

const chrome = {
    commandBar: <CommandBar />,
    railFooter: <ThemeToggle />,
    mobileMenu: <ThemeToggle expanded />,
}

export function AppLayout() {
    return (
        <ThemeProvider>
            <SpacingProvider>
                <PresentationProvider>
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
