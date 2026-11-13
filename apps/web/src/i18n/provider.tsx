import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LocaleContext } from '../core/locale/locale-context'
import type { Catalog } from './catalog'
import { useCatalogs, type Loaded } from './catalogs'
import { createFormat, type Format } from './format'
import { formatTag, type Language } from './languages'

interface I18n {
    language: Language
    messages: Catalog
    format: Format
}

const I18nContext = createContext<I18n | null>(null)

export function LanguageProvider({
    language,
    children,
}: {
    language: Language
    children: ReactNode
}) {
    const catalogs = useCatalogs()
    const [shown, setShown] = useState<{ language: Language; catalog: Loaded } | null>(() => {
        const catalog = catalogs.loaded(language)
        return catalog ? { language, catalog } : null
    })
    useEffect(() => {
        if (shown?.language === language) return
        let live = true
        catalogs.load(language).then((catalog) => {
            if (live) setShown({ language, catalog })
        })
        return () => {
            live = false
        }
    }, [catalogs, language, shown?.language])
    const value = useMemo(
        () =>
            shown && {
                i18n: {
                    language: shown.language,
                    messages: shown.catalog.messages,
                    format: createFormat(formatTag(shown.language)),
                },
                calendar: shown.catalog.calendar,
            },
        [shown],
    )
    const current = value?.i18n.language
    useEffect(() => {
        if (current) document.documentElement.lang = current
    }, [current])
    if (!value) return null
    return (
        <I18nContext value={value.i18n}>
            <LocaleContext
                value={{
                    tag: value.i18n.format.tag,
                    messages: value.i18n.messages.core,
                    calendar: value.calendar,
                }}
            >
                {children}
            </LocaleContext>
        </I18nContext>
    )
}

function useI18n() {
    const value = useContext(I18nContext)
    if (!value) throw new Error('useMessages requires LanguageProvider')
    return value
}

export const useMessages = () => useI18n().messages

export const useFormat = () => useI18n().format

export const useLanguage = () => useI18n().language
