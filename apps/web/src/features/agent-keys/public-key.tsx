import { usePresentation } from '../../components/feedback/presentation-context'
import { Icon } from '../../core/ui/icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../core/ui/tooltip'
import { useMessages } from '../../i18n/provider'

export function PublicKey({ value, label }: { value: string; label: string }) {
    const t = useMessages()
    const { notify } = usePresentation()
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <button
                        type="button"
                        aria-label={label}
                        className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground [&>svg]:size-3.5 [&>svg]:shrink-0"
                        onClick={() =>
                            void navigator.clipboard
                                .writeText(value)
                                .then(() => notify(t.common.copied))
                                .catch(() => notify(t.common.copyFailed, 'error'))
                        }
                    />
                }
            >
                <span className="truncate">{value}</span>
                <Icon name="copy" />
            </TooltipTrigger>
            <TooltipContent>{t.common.copy}</TooltipContent>
        </Tooltip>
    )
}
