import { createBrowserRouter, type RouteObject } from 'react-router'
import { AuthProvider } from './auth/auth-provider'
import { RequireSession } from './auth/require-session'
import { LoginPage } from './auth/login-page'
import { AppLayout } from './app/app-layout'
import { HomePage } from './pages/home'
import { NotFoundPage } from './pages/not-found'
import { SlugRouteProvider } from './routing/slug-route-provider'
import { FleetsPage } from './features/fleets/fleets-page'
import { FleetHomePage } from './features/fleets/fleet-home'
import { PageSpinner } from './core/ui/primitives'
import { AppErrorPage, RootErrorPage } from './components/feedback/error-boundary'
import { withLoadErrors } from './routing/new-build'

const routes: RouteObject[] = [
    {
        Component: AuthProvider,
        HydrateFallback: PageSpinner,
        ErrorBoundary: RootErrorPage,
        children: [
            { path: 'login', Component: LoginPage },
            {
                path: 'auth/complete',
                lazy: {
                    Component: async () => (await import('./auth/complete-page')).CompletePage,
                },
            },
            {
                path: 'signup',
                lazy: {
                    Component: async () => (await import('./auth/signup-page')).SignupPage,
                },
            },
            {
                path: 'setup',
                lazy: {
                    Component: async () => (await import('./auth/setup-page')).SetupPage,
                },
            },
            {
                path: 'reset-password',
                lazy: {
                    Component: async () =>
                        (await import('./auth/reset-password-page')).ResetPasswordPage,
                },
            },
            {
                path: 'invite/:token',
                lazy: {
                    Component: async () => (await import('./auth/invite-page')).InvitePage,
                },
            },
            {
                Component: RequireSession,
                children: [
                    {
                        Component: AppLayout,
                        children: [
                            {
                                ErrorBoundary: AppErrorPage,
                                children: [
                                    { index: true, Component: HomePage },
                                    {
                                        path: 'profile',
                                        lazy: {
                                            Component: async () =>
                                                (await import('./features/account/profile-page'))
                                                    .ProfilePage,
                                        },
                                    },
                                    {
                                        path: 'admin',
                                        lazy: {
                                            Component: async () =>
                                                (await import('./features/account/admin-page'))
                                                    .AdminPage,
                                        },
                                    },
                                    {
                                        path: ':orgSlug',
                                        Component: SlugRouteProvider,
                                        children: [
                                            { index: true, Component: FleetsPage },
                                            {
                                                path: 'settings',
                                                lazy: {
                                                    Component: async () =>
                                                        (
                                                            await import('./features/organizations/general-settings')
                                                        ).GeneralSettingsPage,
                                                },
                                            },
                                            {
                                                path: 'settings/members',
                                                lazy: {
                                                    Component: async () =>
                                                        (
                                                            await import('./features/members/members-page')
                                                        ).MembersPage,
                                                },
                                            },
                                            {
                                                path: 'settings/invitations',
                                                lazy: {
                                                    Component: async () =>
                                                        (
                                                            await import('./features/invitations/invitations-page')
                                                        ).InvitationsPage,
                                                },
                                            },
                                            {
                                                path: 'settings/groups',
                                                lazy: {
                                                    Component: async () =>
                                                        (
                                                            await import('./features/groups/groups-page')
                                                        ).GroupsPage,
                                                },
                                            },
                                            {
                                                path: 'settings/keys',
                                                lazy: {
                                                    Component: async () =>
                                                        (
                                                            await import('./features/agent-keys/agent-keys-page')
                                                        ).AgentKeysPage,
                                                },
                                            },
                                            {
                                                path: ':fleetSlug',
                                                children: [
                                                    { index: true, Component: FleetHomePage },
                                                    {
                                                        path: 'settings',
                                                        lazy: {
                                                            Component: async () =>
                                                                (
                                                                    await import('./features/fleets/general-settings')
                                                                ).FleetGeneralSettingsPage,
                                                        },
                                                    },
                                                    {
                                                        path: 'settings/access',
                                                        lazy: {
                                                            Component: async () =>
                                                                (
                                                                    await import('./features/fleets/access-page')
                                                                ).FleetAccessPage,
                                                        },
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                    { path: '*', Component: NotFoundPage },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
]

export const router = createBrowserRouter(withLoadErrors(routes))
