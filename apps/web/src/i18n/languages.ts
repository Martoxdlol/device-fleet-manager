export const languages = ['en', 'es'] as const

export type Language = (typeof languages)[number]

export const languageNames: Record<Language, string> = { en: 'English', es: 'Español' }

export const isLanguage = (value: unknown): value is Language =>
    languages.some((language) => language === value)

export function browserLanguage(): Language {
    for (const tag of navigator.languages ?? [navigator.language]) {
        const primary = tag?.toLowerCase().split('-')[0]
        if (isLanguage(primary)) return primary
    }
    return 'en'
}

export function formatTag(language: Language): string {
    try {
        const region = navigator.language
            ? new Intl.Locale(navigator.language).maximize().region
            : undefined
        return region ? `${language}-${region}` : language
    } catch {
        return language
    }
}
