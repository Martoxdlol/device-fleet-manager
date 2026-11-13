import type { ReactNode } from 'react'
import { Link } from '../link/link'
import { Icon } from '../ui/icon'
import { Button, Dialog } from '../ui/primitives'
import type { NavItem } from './navigation'
import type { PageAction } from './page-actions'
import { useLocale } from '../locale/locale-context'

const sheetList =
    'flex flex-col gap-[5px] [&_a]:flex [&_a]:items-center [&_a]:gap-2.5 [&_a]:p-[11px] [&_a]:justify-start [&>button]:flex [&>button]:items-center [&>button]:gap-2.5 [&>button]:p-[11px] [&>button]:justify-start [&_a:hover]:bg-accent/70 [&_a[aria-current=page]]:bg-accent'

export function NavigationMenu({
    open,
    onClose,
    items,
    children,
}: {
    open: boolean
    onClose: () => void
    items: NavItem[]
    children?: ReactNode
}) {
    const t = useLocale().messages
    return (
        <Dialog open={open} onClose={onClose} title={t.menu} side="bottom">
            <div className={sheetList}>
                {items.map((item) => (
                    <Link
                        key={item.id}
                        to={item.href}
                        aria-current={item.active ? 'page' : undefined}
                        onClick={onClose}
                    >
                        <Icon name={item.icon} />
                        {item.label}
                    </Link>
                ))}
                {children}
            </div>
        </Dialog>
    )
}

export function ActionsMenu({
    open,
    onClose,
    actions,
}: {
    open: boolean
    onClose: () => void
    actions: PageAction[]
}) {
    const t = useLocale().messages
    return (
        <Dialog open={open} onClose={onClose} title={t.actions} side="bottom">
            <div className={sheetList}>
                {actions.map((action) => (
                    <Button
                        key={action.id}
                        variant="ghost"
                        disabled={action.disabled}
                        onClick={() => {
                            onClose()
                            action.onSelect()
                        }}
                    >
                        <Icon name={action.icon} />
                        {action.label}
                    </Button>
                ))}
            </div>
        </Dialog>
    )
}
