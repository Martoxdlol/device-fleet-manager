import { useLocale } from '../locale/locale-context'

/** Hidden until focused, then moves focus past the chrome to the page's main content. */
export function SkipLink() {
    const t = useLocale().messages
    return (
        <a
            className="fixed -top-25 left-2.5 z-100 border bg-card p-2.5 shadow-lg focus:top-2.5"
            href="#main-content"
            onClick={(event) => {
                event.preventDefault()
                document.getElementById('main-content')?.focus()
            }}
        >
            {t.skipToContent}
        </a>
    )
}
