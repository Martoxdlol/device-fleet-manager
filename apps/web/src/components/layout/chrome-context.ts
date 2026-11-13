import { createContext, type ReactNode } from 'react'

export interface Chrome {
    railHeader?: ReactNode
    railFooter?: ReactNode
    mobileMenu?: ReactNode
    commandBar?: ReactNode
}

export const ChromeContext = createContext<Chrome>({})
