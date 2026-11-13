import { cn } from 'cn'
import { Icon, type IconName } from '../core/ui/icon'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../core/ui/dropdown-menu'
import { Button } from '../core/ui/primitives'
import { Tooltip, TooltipContent, TooltipTrigger } from '../core/ui/tooltip'
import { useMessages } from '../i18n/provider'

export interface RowActionItem {
    key: string
    label: string
    icon: IconName
    onSelect: () => void
    destructive?: boolean
    disabled?: string | false
}

export function RowAction({
    label,
    icon,
    onSelect,
    destructive,
    disabled,
}: Omit<RowActionItem, 'key'>) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={label}
                        aria-disabled={!!disabled || undefined}
                        data-table-interactive
                        className={cn(
                            destructive && 'hover:text-destructive',
                            disabled && 'opacity-50 hover:bg-transparent',
                        )}
                        onClick={() => {
                            if (!disabled) onSelect()
                        }}
                    />
                }
            >
                <Icon name={icon} />
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={6}>
                {disabled || label}
            </TooltipContent>
        </Tooltip>
    )
}

export function RowMenu({ label, items }: { label: string; items: RowActionItem[] }) {
    const t = useMessages()
    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger
                    render={
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={label}
                                    data-table-interactive
                                />
                            }
                        />
                    }
                >
                    <Icon name="more" />
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={6}>
                    {t.common.actions}
                </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-44">
                {items.map((item) => (
                    <DropdownMenuItem
                        key={item.key}
                        disabled={!!item.disabled}
                        variant={item.destructive ? 'destructive' : 'default'}
                        onClick={item.onSelect}
                    >
                        <Icon name={item.icon} />
                        <span className="flex min-w-0 flex-col">
                            {item.label}
                            {item.disabled && (
                                <span className="text-[11px] text-muted-foreground">
                                    {item.disabled}
                                </span>
                            )}
                        </span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
