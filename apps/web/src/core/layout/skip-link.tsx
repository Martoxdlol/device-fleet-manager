import { useLocale } from '../locale/locale-context'

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
