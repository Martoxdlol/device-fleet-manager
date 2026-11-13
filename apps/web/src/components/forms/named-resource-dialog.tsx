import { Button, Dialog, Spinner } from '../../core/ui/primitives'
import { errorMessage, fieldError } from '../../lib/api/errors'
import { useMessages } from '../../i18n/provider'
import { NameSlugFields } from './name-slug-fields'
import { useNameSlug } from './use-name-slug'

export function NamedResourceDialog({
    title,
    urlPrefix,
    pending,
    error,
    onClose,
    onSubmit,
}: {
    title: string
    urlPrefix: string
    pending: boolean
    error: unknown
    onClose: () => void
    onSubmit: (value: { name: string; slug: string }) => void
}) {
    const t = useMessages()
    const state = useNameSlug()
    const nameError = fieldError(error, 'name')
    const slugError = fieldError(error, 'slug')
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
                    if (state.valid && !pending)
                        onSubmit({ name: state.name.trim(), slug: state.slug })
                }}
            >
                <NameSlugFields
                    state={state}
                    urlPrefix={urlPrefix}
                    nameLabel={t.common.name}
                    nameError={nameError}
                    slugError={slugError}
                    disabled={pending}
                    autoFocus
                />
                {error != null && !slugError && !nameError && (
                    <p className="text-[12px] text-destructive" role="alert">
                        {errorMessage(error, t)}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} disabled={pending}>
                        {t.common.cancel}
                    </Button>
                    <Button type="submit" variant="default" disabled={!state.valid || pending}>
                        {pending && <Spinner label={t.common.saving} />}
                        {t.common.create}
                    </Button>
                </div>
            </form>
        </Dialog>
    )
}
