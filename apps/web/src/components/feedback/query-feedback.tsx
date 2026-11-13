import { errorMessage } from '../../lib/api/errors'
import { Button, EmptyState, Spinner } from '../../core/ui/primitives'
import { useMessages } from '../../i18n/provider'

export function LoadingState({ label }: { label: string }) {
    return (
        <EmptyState>
            <Spinner label={label} />
        </EmptyState>
    )
}

export function QueryError({ error, retry }: { error: unknown; retry: () => void }) {
    const t = useMessages()
    return (
        <EmptyState role="alert">
            <p>{errorMessage(error, t)}</p>
            <Button onClick={retry}>{t.common.retry}</Button>
        </EmptyState>
    )
}
