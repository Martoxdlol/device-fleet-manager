import { useTheme } from '../../core/theme/theme-context'
import { Button, ChromeTip } from '../../core/ui/primitives'
import { Icon } from '../../core/ui/icon'
import { useMessages } from '../../i18n/provider'

/** Switches between the light and dark theme. `expanded` is the labelled menu row. */
export function ThemeToggle({ expanded = false }: { expanded?: boolean }) {
    const { theme, setTheme } = useTheme()
    const t = useMessages().components.account
    return (
        <ChromeTip label={t.toggleTheme} enabled={!expanded}>
            <Button
                variant="ghost"
                className={
                    expanded
                        ? 'account-row justify-start h-10.5'
                        : 'icon-button size-9 p-0 shrink-0'
                }
                aria-label={theme === 'light' ? t.toDark : t.toLight}
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
                <Icon name={theme === 'light' ? 'moon' : 'sun'} />
                {expanded && t.appearance}
            </Button>
        </ChromeTip>
    )
}
