import { createContext, useContext } from 'react'
import type { DayPickerLocale } from 'react-day-picker/locale'

export interface CoreMessages {
    close: string
    loading: string
    menu: string
    actions: string
    moreActions: string
    skipToContent: string
    primaryNavigation: string
    mobileNavigation: string
    moreNavigation: string
    navigationPanel: string
    detailsPanel: string
    openNavigationPanel: string
    openDetailsPanel: string
    showNavigationPanel: string
    hideNavigationPanel: string
    resizeNavigationPanel: string
    resizeDetails: string
}

export const coreEnglish: CoreMessages = {
    close: 'Close',
    loading: 'Loading',
    menu: 'Menu',
    actions: 'Actions',
    moreActions: 'More actions',
    skipToContent: 'Skip to content',
    primaryNavigation: 'Primary navigation',
    mobileNavigation: 'Mobile navigation',
    moreNavigation: 'More navigation',
    navigationPanel: 'Navigation panel',
    detailsPanel: 'Details panel',
    openNavigationPanel: 'Open navigation panel',
    openDetailsPanel: 'Open details panel',
    showNavigationPanel: 'Show navigation panel',
    hideNavigationPanel: 'Hide navigation panel',
    resizeNavigationPanel: 'Resize navigation panel',
    resizeDetails: 'Resize details',
}

export interface Locale {
    tag: string
    messages: CoreMessages
    calendar?: DayPickerLocale
}

export const LocaleContext = createContext<Locale>({ tag: 'en-US', messages: coreEnglish })

export function useLocale() {
    return useContext(LocaleContext)
}
