import { useEffect, type ReactNode } from 'react'

import { oneOf, useStoredState } from '../storage/use-stored-state'
import { ThemeContext } from './theme-context'

const themes = oneOf(['light', 'dark'])

/** Light or dark, light by default, remembered per browser. Dark is the `dark` class on `<html>`. */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useStoredState('theme', 'light', themes)
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
    }, [theme])
    return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
}
