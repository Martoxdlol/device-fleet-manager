import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppLayout } from './app/app-layout'
import { NotFoundPage } from './pages/not-found'
import { PageSpinner } from './core/ui/primitives'
import { AppErrorPage, RootErrorPage } from './components/feedback/error-boundary'
import { withLoadErrors } from './routing/new-build'

const routes: RouteObject[] = [
    {
        HydrateFallback: PageSpinner,
        ErrorBoundary: RootErrorPage,
        children: [
            {
                Component: AppLayout,
                children: [
                    {
                        // Every page draws its own shell, so this keeps the rail when one fails before it does.
                        ErrorBoundary: AppErrorPage,
                        children: [
                            {
                                index: true,
                                lazy: {
                                    Component: async () => (await import('./pages/home')).HomePage,
                                },
                            },
                            { path: '*', Component: NotFoundPage },
                        ],
                    },
                ],
            },
        ],
    },
]

export const router = createBrowserRouter(withLoadErrors(routes))
