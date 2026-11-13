import { useState } from 'react'
import { Input } from '../../core/ui/input'
import { Button, Dialog, Field, Spinner } from '../../core/ui/primitives'
import { errorMessage, fieldError } from '../../lib/api/errors'
import { useMessages } from '../../i18n/provider'

export function NameDialog({
    title,
    initialName = '',
    submitLabel,
    pending,
    error,
    onClose,
    onSubmit,
}: {
    title: string
    initialName?: string
    submitLabel: string
    pending: boolean
    error: unknown
    onClose: () => void
    onSubmit: (name: string) => void
}) {
    const t = useMessages()
    const [name, setName] = useState(initialName)
    const nameError = fieldError(error, 'name')
    const valid = !!name.trim() && name.trim() !== initialName
    return (
        <Dialog
            open
            title={title}
            onClose={() => {
                if (!pending) onClose()
            }}
        >
            <form
                className="flex flex-col gap-4.5"
                aria-busy={pending}
                onSubmit={(event) => {
                    event.preventDefault()
                    if (valid && !pending) onSubmit(name.trim())
                }}
            >
                <Field label={t.common.name} error={nameError}>
                    <Input
                        required
                        autoFocus
                        maxLength={200}
                        value={name}
                        disabled={pending}
                        onChange={(event) => setName(event.target.value)}
                    />
                </Field>
                {error != null && !nameError && (
                    <p className="text-[12px] text-destructive" role="alert">
                        {errorMessage(error, t)}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} disabled={pending}>
                        {t.common.cancel}
                    </Button>
                    <Button type="submit" variant="default" disabled={!valid || pending}>
                        {pending && <Spinner label={t.common.saving} />}
                        {submitLabel}
                    </Button>
                </div>
            </form>
        </Dialog>
    )
}
