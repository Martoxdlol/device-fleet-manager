import { cn } from 'cn'
import { CircleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../../core/ui/icon'
import { useMessages } from '../../i18n/provider'
import { PresentationContext, type NoticeAction } from './presentation-context'

type Notice = { message: string; tone?: 'error'; action?: NoticeAction; open: boolean }

export function PresentationProvider({ children }: { children: ReactNode }) {
    const t = useMessages()
    const [notice, setNotice] = useState<Notice>({ message: '', open: false })
    const close = () => setNotice((current) => ({ ...current, open: false }))
    useEffect(() => {
        if (!notice.open || notice.tone === 'error') return
        const timer = setTimeout(
            () => setNotice((current) => ({ ...current, open: false })),
            notice.action ? 8000 : 3500,
        )
        return () => clearTimeout(timer)
    }, [notice])
    const error = notice.tone === 'error'
    return (
        <PresentationContext
            value={{
                notify: (message, tone, action) =>
                    setNotice({ message, tone, action, open: !!message }),
            }}
        >
            {children}
            <div
                role={error ? 'alert' : 'status'}
                className={cn(
                    'toast fixed bottom-5 left-[50%] transform-[translate(-50%,_12px)] z-100 pointer-events-none flex items-center gap-2.5 bg-foreground text-background shadow-[0_4px_20px_#0002] py-2.5 px-4 text-[12px] opacity-0 transition-all duration-200 [&.visible]:opacity-100 [&.visible]:transform-[translate(-50%,_0)] max-md:bottom-22.5 max-md:max-w-[calc(100vw_-_24px)] max-md:whitespace-nowrap',
                    notice.open && 'visible',
                    (error || notice.action) && notice.open && 'pointer-events-auto pr-2',
                )}
            >
                {error && <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />}
                {notice.message}
                {notice.action && (
                    <button
                        type="button"
                        className="-my-1 shrink-0 px-2 py-1 font-semibold underline-offset-2 hover:underline"
                        onClick={() => {
                            const action = notice.action
                            close()
                            action?.run()
                        }}
                    >
                        {notice.action.label}
                    </button>
                )}
                {error && (
                    <button
                        type="button"
                        aria-label={t.components.feedback.dismiss}
                        className="grid size-6 shrink-0 place-items-center opacity-70 hover:opacity-100 [&_svg]:size-3.5"
                        onClick={close}
                    >
                        <Icon name="close" />
                    </button>
                )}
            </div>
        </PresentationContext>
    )
}
