import type { Language } from './languages'

export interface Forms<T> {
    one: T
    other: T
}

export function pluralFor(language: Language) {
    const rules = new Intl.PluralRules(language)
    return <T>(count: number, forms: Forms<T>): T =>
        rules.select(count) === 'one' ? forms.one : forms.other
}
