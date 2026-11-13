import { Popover, PopoverContent, PopoverTrigger } from '../core/ui/popover'
import { Button } from '../core/ui/primitives'
import { Icon, type IconName } from '../core/ui/icon'
import { useMobile } from '../core/scaffold/use-mobile'
import { useMessages } from '../i18n/provider'

export interface SearchResult {
    icon: IconName
    label: string
    where?: string
}

function SearchPanel({ results }: { results: SearchResult[] }) {
    const t = useMessages().app.commandBar
    return (
        <>
            <label className="flex h-8 items-center gap-2 px-2 text-muted-foreground">
                <Icon name="search" className="size-3.5" />
                <input
                    autoFocus
                    aria-label={t.placeholder}
                    placeholder={t.placeholder}
                    className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
            </label>
            {results.map((item) => (
                <button
                    key={item.label}
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground"
                >
                    <Icon name={item.icon} />
                    <span className="truncate">{item.label}</span>
                    {item.where && (
                        <span className="ml-auto shrink-0 text-muted-foreground">{item.where}</span>
                    )}
                </button>
            ))}
        </>
    )
}

export function CommandBar({ results = [] }: { results?: SearchResult[] }) {
    const t = useMessages().app.commandBar
    const mobile = useMobile()
    if (mobile)
        return (
            <>
                <Popover>
                    <PopoverTrigger
                        render={
                            <Button
                                variant="ghost"
                                className="icon-button size-8 p-0 shrink-0"
                                aria-label={t.placeholder}
                            />
                        }
                    >
                        <Icon name="search" />
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[calc(100vw-24px)] p-1">
                        <SearchPanel results={results} />
                    </PopoverContent>
                </Popover>
            </>
        )
    return (
        <>
            <Popover>
                <PopoverTrigger className="flex h-8 min-w-0 flex-1 items-center gap-2 px-3 text-xs text-muted-foreground outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring/50 dark:hover:bg-muted/50">
                    <Icon name="search" className="size-3.5 shrink-0" />
                    <span className="truncate">{t.placeholder}</span>
                </PopoverTrigger>
                <PopoverContent sideOffset={-36} className="w-(--anchor-width) min-w-80 p-1">
                    <SearchPanel results={results} />
                </PopoverContent>
            </Popover>
        </>
    )
}
