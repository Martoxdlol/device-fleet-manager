import { PageLayout } from '../components/layout/page-layout'
import { PageContent } from '../core/scaffold/scaffold'
import { EmptyState } from '../core/ui/primitives'
import { useMessages } from '../i18n/provider'

export function NotFoundPage() {
    const t = useMessages().pages.notFound
    return (
        <PageLayout title={t.title}>
            <PageContent>
                <EmptyState surface>
                    <h2>{t.heading}</h2>
                </EmptyState>
            </PageContent>
        </PageLayout>
    )
}
