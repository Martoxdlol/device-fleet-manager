import { Component, type ReactNode } from 'react'
import { useLocation, useRevalidator, useRouteError } from 'react-router'
import type { BoundaryName } from '../../core/boundary/boundary-context'
import { PageContent } from '../../core/scaffold/scaffold'
import { useMessages } from '../../i18n/provider'
import { PageLayout } from '../layout/page-layout'
import { ErrorBox } from './error-box'

interface CatcherProps {
    locationKey: string
    children: ReactNode
}

interface CatcherState {
    failed: boolean
    error: unknown
    locationKey: string
}

/** Holds a crash until Try again or a navigation, so a healthy subtree is never remounted. */
class Catcher extends Component<CatcherProps, CatcherState> {
    state: CatcherState = { failed: false, error: undefined, locationKey: this.props.locationKey }

    static getDerivedStateFromError(error: unknown): Partial<CatcherState> {
        return { failed: true, error }
    }

    static getDerivedStateFromProps(props: CatcherProps, state: CatcherState) {
        return props.locationKey === state.locationKey
            ? null
            : { failed: false, error: undefined, locationKey: props.locationKey }
    }

    reset = () => this.setState({ failed: false, error: undefined })

    render() {
        if (!this.state.failed) return this.props.children
        return <ErrorBox error={this.state.error} onRetry={this.reset} className="p-2" />
    }
}

/**
 * Contains a crash below it to the part of the screen it wraps (docs/client-telemetry-design.md).
 * `name` says which part, for the error reports that design adds.
 */
export function ErrorBoundary({
    children,
}: {
    name: BoundaryName | 'preview' | 'message'
    children: ReactNode
}) {
    const location = useLocation()
    return <Catcher locationKey={location.key}>{children}</Catcher>
}

/** In place of everything under the router: no theme, chrome or session from below it. */
export function RootErrorPage() {
    const error = useRouteError()
    const { revalidate } = useRevalidator()
    return (
        <div className="grid min-h-dvh place-items-center bg-background p-4">
            <ErrorBox error={error} onRetry={() => void revalidate()} className="max-w-md" />
        </div>
    )
}

/** In place of a page that failed before it drew its shell, or whose chunk did not load. */
export function AppErrorPage() {
    const error = useRouteError()
    const t = useMessages().errors
    const { revalidate } = useRevalidator()
    return (
        <PageLayout title={t.title}>
            <PageContent>
                <ErrorBox error={error} onRetry={() => void revalidate()} />
            </PageContent>
        </PageLayout>
    )
}
