import type { ReactNode } from 'react'
import { brandName } from '../brand'
import { ThemeProvider } from '../core/theme/theme-provider'
import { Button, Spinner, Surface } from '../core/ui/primitives'
import { errorMessage } from '../lib/api/errors'
import { useMessages } from '../i18n/provider'

function Mark({ className }: { className: string }) {
    return (
        <>
            <img
                className={`${className} dark:hidden`}
                src="/icon-light-transparent.svg"
                alt=""
                aria-hidden="true"
            />
            <img
                className={`${className} hidden dark:block`}
                src="/icon-dark-transparent.svg"
                alt=""
                aria-hidden="true"
            />
        </>
    )
}

export function AuthScreen({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <main className="h-(--viewport-height) grid md:grid-cols-2 gap-2 p-2 bg-background text-foreground">
                <Surface className="hidden md:grid place-items-center">
                    <Mark className="w-[min(40%,200px)]" />
                </Surface>
                <div className="grid place-items-center min-h-0 overflow-auto p-6">
                    <div className="flex w-full max-w-80 flex-col gap-6">
                        <div className="flex flex-col items-start gap-4">
                            <Mark className="size-12 md:hidden" />
                            <p className="text-[13px] font-medium text-muted-foreground">
                                {brandName}
                            </p>
                        </div>
                        {children}
                    </div>
                </div>
            </main>
        </ThemeProvider>
    )
}

export function AuthTitle({ children }: { children: ReactNode }) {
    return (
        <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em]">{children}</h1>
    )
}

export function AuthError({ error }: { error?: string }) {
    if (!error) return null
    return (
        <p role="alert" className="text-xs text-destructive">
            {error}
        </p>
    )
}

export const authLink =
    'text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline'

export function AuthQueryState({
    query,
}: {
    query: { isError: boolean; error: unknown; refetch: () => unknown }
}) {
    const t = useMessages()
    if (!query.isError) return <Spinner label={t.common.loading} />
    return (
        <div className="flex flex-col items-start gap-3">
            <AuthError error={errorMessage(query.error, t)} />
            <Button onClick={() => void query.refetch()}>{t.common.retry}</Button>
        </div>
    )
}
