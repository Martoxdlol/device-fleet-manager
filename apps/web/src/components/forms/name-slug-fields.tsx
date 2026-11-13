import { Icon } from '../../core/ui/icon'
import { Input } from '../../core/ui/input'
import { Field } from '../../core/ui/primitives'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../core/ui/tooltip'
import { useMessages } from '../../i18n/provider'
import { isSlug, SLUG_MAX } from './resource-slug'
import type { NameSlug } from './use-name-slug'

export function SlugInput({
    prefix,
    value,
    onChange,
    disabled,
    invalid,
    autoFocus,
}: {
    prefix: string
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    invalid?: boolean
    autoFocus?: boolean
}) {
    return (
        <span className="flex h-8 min-w-0 items-center border border-input text-xs focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50 dark:bg-input/30">
            <span className="max-w-1/2 shrink-0 truncate pl-2.5 text-muted-foreground">
                {prefix}
            </span>
            <input
                required
                autoFocus={autoFocus}
                maxLength={SLUG_MAX}
                value={value}
                disabled={disabled}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid}
                className="h-full min-w-0 flex-1 bg-transparent pr-2.5 outline-none"
                onChange={(event) => onChange(event.target.value)}
            />
        </span>
    )
}

export function NameSlugFields({
    state,
    urlPrefix,
    nameLabel,
    nameError,
    slugError,
    disabled,
    autoFocus,
}: {
    state: NameSlug
    urlPrefix: string
    nameLabel: string
    nameError?: string
    slugError?: string
    disabled?: boolean
    autoFocus?: boolean
}) {
    const t = useMessages()
    const text = t.components.forms
    const refused = !!state.name.trim() && !isSlug(state.slug)
    const editing = state.custom !== null || !!slugError || refused
    const prefix = `${window.location.host}${urlPrefix}`
    return (
        <>
            <div className="flex flex-col gap-2">
                <Field label={nameLabel} error={nameError}>
                    <Input
                        required
                        autoFocus={autoFocus}
                        maxLength={200}
                        value={state.name}
                        disabled={disabled}
                        onChange={(event) => state.setName(event.target.value)}
                    />
                </Field>
                {!editing && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <button
                                    type="button"
                                    aria-label={text.editUrl(`${prefix}${state.slug}`)}
                                    disabled={disabled}
                                    className="flex min-w-0 items-center gap-1.5 self-start text-[12px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:underline [&>svg]:size-3.5 [&>svg]:shrink-0"
                                    onClick={() => state.setCustom(state.slug)}
                                />
                            }
                        >
                            <span className="truncate">
                                {prefix}
                                <span className="text-foreground">{state.slug}</span>
                            </span>
                            <Icon name="edit" />
                        </TooltipTrigger>
                        <TooltipContent>{text.editUrlTip}</TooltipContent>
                    </Tooltip>
                )}
            </div>
            {editing && (
                <Field label={text.url} error={slugError} hint={text.slugHint}>
                    <SlugInput
                        prefix={prefix}
                        value={state.slug}
                        onChange={state.setCustom}
                        disabled={disabled}
                        invalid={!!slugError || refused}
                        autoFocus={state.custom !== null}
                    />
                </Field>
            )}
        </>
    )
}
