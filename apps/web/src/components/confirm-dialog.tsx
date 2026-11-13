import { useState, type ReactNode } from 'react'
import { Input } from '../core/ui/input'
import { Button, Dialog, Field, Spinner } from '../core/ui/primitives'
import { useMessages } from '../i18n/provider'
import { errorMessage } from '../lib/api/errors'

export function ConfirmDialog({
    title,
    label,
    typed,
    describe,
    onClose,
    onConfirm,
    children,
}: {
    title: string
    label?: string
    typed?: string
    describe?: (error: unknown) => string
    onClose: () => void
    onConfirm: () => Promise<unknown>
    children?: ReactNode
}) {
    const t = useMessages()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<unknown>(null)
    const [text, setText] = useState('')
    const valid = typed === undefined || text === typed
    const action = label ?? t.common.delete
    return (
        <Dialog open title={title} onClose={() => !pending && onClose()}>
            <form
                className="flex flex-col gap-4.5"
                aria-busy={pending}
                onSubmit={async (event) => {
                    event.preventDefault()
                    if (pending || !valid) return
                    setPending(true)
                    setError(null)
                    try {
                        await onConfirm()
                        onClose()
                    } catch (cause) {
                        setError(cause)
                    } finally {
                        setPending(false)
                    }
                }}
            >
                {children}
                {typed !== undefined && (
                    <Field label={t.components.confirm.type(typed)}>
                        <Input
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            disabled={pending}
                            autoCapitalize="none"
                            autoComplete="off"
                            spellCheck={false}
                            autoFocus
                        />
                    </Field>
                )}
                {error != null && (
                    <p role="alert" className="text-[12px] text-destructive">
                        {describe ? describe(error) : errorMessage(error, t)}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} disabled={pending}>
                        {t.common.cancel}
                    </Button>
                    <Button type="submit" variant="destructive" disabled={!valid || pending}>
                        {pending && <Spinner label={action} />}
                        {action}
                    </Button>
                </div>
            </form>
        </Dialog>
    )
}
