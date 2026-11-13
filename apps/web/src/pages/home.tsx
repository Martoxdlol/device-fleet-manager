import { PageLayout } from '../components/layout/page-layout'
import { PageContent } from '../core/scaffold/scaffold'
import { EmptyState } from '../core/ui/primitives'
import { useMessages } from '../i18n/provider'

export function HomePage() {
    const t = useMessages().pages.home
    return (
        <PageLayout title={t.title}>
            <PageContent>
                <EmptyState surface>
                    <h2>{t.heading}</h2>
                    <p>{t.description}</p>
                </EmptyState>
            </PageContent>
        </PageLayout>
    )
}
