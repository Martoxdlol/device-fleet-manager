import { createContext, useContext } from 'react'
import type { DayPickerLocale } from 'react-day-picker/locale'
import type { Catalog } from './catalog'
import type { Language } from './languages'

export interface Loaded {
    messages: Catalog
    calendar: DayPickerLocale
}

const importers: Record<Language, () => Promise<Loaded>> = {
    en: () => import('./en').then(({ en, calendar }) => ({ messages: en, calendar })),
    es: () => import('./es').then(({ es, calendar }) => ({ messages: es, calendar })),
}

export function createCatalogs() {
    const loaded = new Map<Language, Loaded>()
    const pending = new Map<Language, Promise<Loaded>>()
    return {
        loaded: (language: Language) => loaded.get(language),
        load(language: Language) {
            let request = pending.get(language)
            if (!request) {
                request = importers[language]().then((catalog) => {
                    loaded.set(language, catalog)
                    return catalog
                })
                pending.set(language, request)
                request.catch(() => pending.delete(language))
            }
            return request
        },
    }
}

export type Catalogs = ReturnType<typeof createCatalogs>

export const CatalogsContext = createContext<Catalogs | null>(null)

export function useCatalogs() {
    const catalogs = useContext(CatalogsContext)
    if (!catalogs) throw new Error('useCatalogs requires CatalogsContext')
    return catalogs
}
