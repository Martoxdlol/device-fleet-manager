import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import type { KeyBinding } from '../core/keyboard/keyboard-context'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuTrigger,
} from '../core/ui/context-menu'
import { Sheet, SheetContent, SheetTitle } from '../core/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '../core/ui/tooltip'
import { useMessages } from '../i18n/provider'
import { keyLabel } from '../lib/platform'

export interface MenuItem {
    key: string
    label: string
    icon: ReactNode
    /** Shown on the right, written for the platform. */
    keys?: KeyBinding
    /** The browser's own event runs it, such as a paste: the keys show but are not bound. */
    nativeKeys?: boolean
    /** Items of one group sit together; groups are separated in the order they first appear. */
    group?: string
    /** Disables the item; a reason says why. */
    disabled?: string | boolean
    variant?: 'default' | 'destructive'
    onSelect: () => void
}

export interface MenuRequest {
    /** What the menu acts on, the title of the sheet a long press opens. */
    title: string
    items: readonly MenuItem[]
    /** True when this menu opens, false when it closes. */
    onOpenChange?: (open: boolean) => void
}

type Offer = () => MenuRequest | undefined

const OfferContext = createContext<((offer: Offer) => void) | null>(null)

/**
 * What an element inside an `ActionMenuArea` spreads to have its own menu: a right-click, a long
 * press or `openMenuFrom` on it opens what `offer` answers when it opens.
 */
export function useMenuTarget() {
    const offer = useContext(OfferContext)
    return (request: Offer) =>
        offer
            ? { onPointerDown: () => offer(request), onContextMenu: () => offer(request) }
            : undefined
}

/** Shift+F10 and the Menu key open the menu of the focused element. */
export const isMenuKey = (event: { key: string; shiftKey: boolean }) =>
    event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)

/** Opens the menu of `element` from the keyboard, under its start. */
export function openMenuFrom(element: Element) {
    const box = element.getBoundingClientRect()
    element.dispatchEvent(
        new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            button: 2,
            clientX: box.left + Math.min(box.width / 2, 48),
            clientY: box.bottom,
        }),
    )
}

function groupsOf(items: readonly MenuItem[]) {
    const groups: MenuItem[][] = []
    const index = new Map<string, number>()
    for (const item of items) {
        const name = item.group ?? ''
        if (!index.has(name)) {
            index.set(name, groups.length)
            groups.push([])
        }
        groups[index.get(name)!].push(item)
    }
    return groups
}

/**
 * An area whose right-click, Shift+F10 and Menu key open a menu at the pointer or the focused
 * element, and whose long press on touch opens it as a bottom sheet. Elements in it name their
 * own menu with `useMenuTarget`; anywhere else in it opens `fallback`'s.
 */
export function ActionMenuArea({ fallback, children }: { fallback?: Offer; children: ReactNode }) {
    const t = useMessages()
    const keys = t.components.keys
    const pending = useRef<Offer | undefined>(undefined)
    const pointer = useRef('mouse')
    const swallow = useRef(false)
    const [menu, setMenu] = useState<MenuRequest | null>(null)
    const [open, setOpen] = useState(false)
    const [sheet, setSheet] = useState<MenuRequest | null>(null)
    const reset = () => {
        pending.current = fallback
    }
    const closeSheet = () => {
        sheet?.onOpenChange?.(false)
        setSheet(null)
    }
    const run = (item: MenuItem) => {
        if (!item.disabled) item.onSelect()
    }
    return (
        <OfferContext
            value={(offer) => {
                pending.current = offer
            }}
        >
            <ContextMenu
                open={open}
                onOpenChange={(next) => {
                    if (!next) {
                        setOpen(false)
                        menu?.onOpenChange?.(false)
                        return
                    }
                    const request = pending.current?.()
                    if (!request?.items.length) return
                    request.onOpenChange?.(true)
                    if (pointer.current === 'touch') {
                        swallow.current = true
                        setSheet(request)
                        return
                    }
                    setMenu(request)
                    setOpen(true)
                }}
            >
                <ContextMenuTrigger
                    className="contents select-auto"
                    onPointerDownCapture={(event) => {
                        pointer.current = event.pointerType
                        swallow.current = false
                        reset()
                    }}
                    onKeyDownCapture={() => {
                        pointer.current = 'keyboard'
                    }}
                    onContextMenuCapture={(event) => {
                        // A text field keeps the browser's menu, with its Paste.
                        if (
                            event.target instanceof Element &&
                            event.target.closest('input, textarea, [contenteditable=true]')
                        ) {
                            event.stopPropagation()
                            return
                        }
                        reset()
                    }}
                    onClickCapture={(event) => {
                        // The press that opened the sheet opens nothing else.
                        if (!swallow.current) return
                        swallow.current = false
                        event.preventDefault()
                        event.stopPropagation()
                    }}
                >
                    {children}
                </ContextMenuTrigger>
                <ContextMenuContent className="min-w-52">
                    {menu &&
                        groupsOf(menu.items).map((group, index) => [
                            index > 0 && <ContextMenuSeparator key={`separator:${index}`} />,
                            ...group.map((item) => {
                                const entry = (
                                    <ContextMenuItem
                                        key={item.key}
                                        disabled={!!item.disabled}
                                        variant={item.variant}
                                        className="data-disabled:pointer-events-auto"
                                        onClick={() => run(item)}
                                    >
                                        {item.icon}
                                        <span className="truncate">{item.label}</span>
                                        {item.keys && (
                                            <ContextMenuShortcut className="pl-6 tracking-normal">
                                                {keyLabel(item.keys, keys)}
                                            </ContextMenuShortcut>
                                        )}
                                    </ContextMenuItem>
                                )
                                return typeof item.disabled === 'string' ? (
                                    <Tooltip key={item.key}>
                                        <TooltipTrigger render={entry} />
                                        <TooltipContent side="right" sideOffset={8}>
                                            {item.disabled}
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    entry
                                )
                            }),
                        ])}
                </ContextMenuContent>
            </ContextMenu>
            <Sheet
                open={!!sheet}
                onOpenChange={(next) => {
                    if (!next) closeSheet()
                }}
            >
                <SheetContent
                    side="bottom"
                    showCloseButton={false}
                    className="max-h-[70dvh] overflow-y-auto overscroll-contain pb-(--safe-area-bottom)"
                >
                    {sheet && (
                        <>
                            <SheetTitle className="truncate px-4 pt-3.5 pb-1.5 text-xs text-muted-foreground">
                                {sheet.title}
                            </SheetTitle>
                            {groupsOf(sheet.items).map((group, index) => (
                                <div key={index} className={index ? 'border-t py-1' : 'pb-1'}>
                                    {group.map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            disabled={!!item.disabled}
                                            data-variant={item.variant}
                                            className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-[13px] active:bg-accent disabled:text-muted-foreground data-[variant=destructive]:text-destructive [&>svg]:size-4 [&>svg]:shrink-0"
                                            onClick={() => {
                                                closeSheet()
                                                run(item)
                                            }}
                                        >
                                            {item.icon}
                                            <span className="min-w-0">
                                                <span className="block truncate">{item.label}</span>
                                                {typeof item.disabled === 'string' && (
                                                    <span className="block text-[11px]">
                                                        {item.disabled}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </OfferContext>
    )
}
