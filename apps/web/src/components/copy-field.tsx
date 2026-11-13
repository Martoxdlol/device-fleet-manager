import { cn } from 'cn'
import { useRef } from 'react'
import { Icon } from '../core/ui/icon'
import { Input } from '../core/ui/input'
import { Button, ChromeTip, Dialog } from '../core/ui/primitives'
import { useMessages } from '../i18n/provider'
import { usePresentation } from './feedback/presentation-context'

export function CopyField({
    value,
    label,
    mono = false,
}: {
    value: string
    label: string
    mono?: boolean
}) {
    const t = useMessages()
    const { notify } = usePresentation()
    const input = useRef<HTMLInputElement>(null)
    const copy = () =>
        navigator.clipboard
            .writeText(value)
            .then(() => notify(t.common.copied))
            .catch(() => input.current?.select())
    return (
        <div className="flex min-w-0 items-center gap-1">
            <Input
                ref={input}
                readOnly
                value={value}
                aria-label={label}
                className={cn('min-w-0 flex-1', mono && 'font-mono')}
                onFocus={(event) => event.currentTarget.select()}
            />
            <ChromeTip label={t.common.copy} side="bottom">
                <Button variant="ghost" size="icon" aria-label={t.common.copy} onClick={copy}>
                    <Icon name="copy" />
                </Button>
            </ChromeTip>
        </div>
    )
}

export function LinkDialog({
    title,
    hint,
    link,
    onClose,
}: {
    title: string
    hint: string
    link: string
    onClose: () => void
}) {
    const t = useMessages()
    return (
        <Dialog open title={title} description={hint} onClose={onClose}>
            <div className="flex flex-col gap-4.5">
                <CopyField value={link} label={title} />
                <div className="flex justify-end">
                    <Button variant="default" onClick={onClose}>
                        {t.common.done}
                    </Button>
                </div>
            </div>
        </Dialog>
    )
}
