import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '../../core/ui/dropdown-menu'
import { displayName, initials, useAccount, useAuth } from '../../auth/auth-context'
import { useAppNavigate } from '../../auth/navigation'
import { Button } from '../../core/ui/primitives'
import { Icon } from '../../core/ui/icon'
import { useMessages } from '../../i18n/provider'
import { ThemeToggle } from './theme-toggle'

export function AccountControls({ expanded = false }: { expanded?: boolean }) {
    return (
        <>
            <ThemeToggle expanded={expanded} />
            <AccountMenu expanded={expanded} />
        </>
    )
}

export function AccountMenu({
    expanded = false,
    side = expanded ? 'top' : 'right',
}: {
    expanded?: boolean
    side?: 'top' | 'right' | 'bottom'
}) {
    const t = useMessages()
    const navigate = useAppNavigate()
    const { logout } = useAuth()
    const { user } = useAccount()
    const name = displayName(user)
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        className={
                            expanded
                                ? 'account-row justify-start h-10.5'
                                : 'icon-button size-9 p-0 shrink-0'
                        }
                        aria-label={t.components.account.menu}
                    />
                }
            >
                <span className="avatar w-7 h-7 rounded-full inline-flex items-center justify-center bg-secondary text-[10px] font-semibold shrink-0">
                    {initials(user)}
                </span>
                {expanded && name}
            </DropdownMenuTrigger>
            <DropdownMenuContent side={side} align="end">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{name}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                        <Icon name="user" />
                        {t.components.account.profile}
                    </DropdownMenuItem>
                    {user.instance_admin && (
                        <DropdownMenuItem onClick={() => navigate('/admin')}>
                            <Icon name="lock" />
                            {t.components.account.admin}
                        </DropdownMenuItem>
                    )}
                </DropdownMenuGroup>
                <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => void logout()}>
                        <Icon name="logout" />
                        {t.components.account.signOut}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
