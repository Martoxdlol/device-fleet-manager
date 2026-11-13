import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { ViewportProvider } from './core/viewport/viewport-provider'
import { KeyboardProvider } from './core/keyboard/keyboard-provider'
import { HistoryProvider } from './app/history-provider'
import { TooltipProvider } from './core/ui/tooltip'
import { StorageProvider } from './core/storage/storage-provider'
import { LinkContext, type LinkProps } from './core/link/link-context'
import { AppLink } from './auth/app-link'
import { CatalogsContext, createCatalogs } from './i18n/catalogs'
import { browserLanguage } from './i18n/languages'
import { LanguageProvider } from './i18n/provider'
import { reloadOnMissingChunks } from './routing/new-build'
import './index.css'

reloadOnMissingChunks()

const renderLink = (props: LinkProps) => <AppLink {...props} />

const catalogs = createCatalogs()
const language = browserLanguage()

catalogs
    .load(language)
    .catch(() => undefined)
    .then(() =>
        createRoot(document.getElementById('root')!).render(
            <StrictMode>
                <CatalogsContext value={catalogs}>
                    <LanguageProvider language={language}>
                        <StorageProvider prefix="fleet.view.">
                            <LinkContext value={renderLink}>
                                <ViewportProvider>
                                    <KeyboardProvider>
                                        <HistoryProvider router={router}>
                                            <TooltipProvider delay={300}>
                                                <RouterProvider router={router} />
                                            </TooltipProvider>
                                        </HistoryProvider>
                                    </KeyboardProvider>
                                </ViewportProvider>
                            </LinkContext>
                        </StorageProvider>
                    </LanguageProvider>
                </CatalogsContext>
            </StrictMode>,
        ),
    )
