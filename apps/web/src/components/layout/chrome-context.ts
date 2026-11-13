import { createContext, type ReactNode } from 'react'

/** The rail and menu controls around every page, supplied by whatever owns the session. */
export interface Chrome {
    railHeader?: ReactNode
    railFooter?: ReactNode
    mobileMenu?: ReactNode
    commandBar?: ReactNode
}

export const ChromeContext = createContext<Chrome>({})
