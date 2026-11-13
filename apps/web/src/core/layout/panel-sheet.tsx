import { useContext, type ReactNode } from 'react'
import { Sheet, SheetContent } from '../ui/sheet'
import { AppFrameContext } from '../scaffold/app-frame-context'
import { spacingVariables, useSpacing } from '../scaffold/spacing-context'
import { PanelSheetContext } from './panel-sheet-context'

export function PanelSheet({
    open,
    onClose,
    side,
    label,
    children,
}: {
    open: boolean
    onClose: () => void
    side: 'left' | 'right'
    label: string
    children: ReactNode
}) {
    const spacing = useSpacing()
    const area = useContext(AppFrameContext)?.area
    return (
        <Sheet
            open={open}
            onOpenChange={(value) => {
                if (!value) onClose()
            }}
        >
            <SheetContent
                side={side}
                showCloseButton={false}
                container={area}
                aria-label={label}
                className="max-h-(--viewport-height) pt-[env(safe-area-inset-top)] pb-(--safe-area-bottom)"
                style={spacingVariables(spacing)}
            >
                <PanelSheetContext value>
                    <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-thin">
                        {children}
                    </div>
                </PanelSheetContext>
            </SheetContent>
        </Sheet>
    )
}
