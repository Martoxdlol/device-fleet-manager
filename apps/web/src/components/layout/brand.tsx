import { brandName } from '../../brand'
import { AppLink } from '../../auth/app-link'
import { useMessages } from '../../i18n/provider'

export function Brand({ home = '/' }: { home?: string }) {
    const t = useMessages()
    return (
        <AppLink
            to={home}
            className="brand flex items-center justify-center size-9 [&_img]:size-9"
            aria-label={t.components.brand.home(brandName)}
        >
            <img
                className="brand-light dark:hidden"
                src="/icon-light-transparent.svg"
                width="36"
                height="36"
                alt=""
            />
            <img
                className="brand-dark hidden dark:block"
                src="/icon-dark-transparent.svg"
                width="36"
                height="36"
                alt=""
            />
        </AppLink>
    )
}
