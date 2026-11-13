import { createContext, useContext } from 'react'
import type { DayPickerLocale } from 'react-day-picker/locale'

/** Every word core says itself. An app in another language passes its own through `LocaleContext`. */
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
    /** The BCP 47 tag dates and numbers format with, such as `es-US`. */
    tag: string
    messages: CoreMessages
    /** react-day-picker's names of months and days. Its own English when absent. */
    calendar?: DayPickerLocale
}

/** English with the browser's formats unless an app provides its own. */
export const LocaleContext = createContext<Locale>({ tag: 'en-US', messages: coreEnglish })

export function useLocale() {
    return useContext(LocaleContext)
}
