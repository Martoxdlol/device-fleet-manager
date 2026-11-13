import { useEffect, useRef, useState, type ReactNode } from 'react'
import { KeyboardContext, matchesKey, type KeyBinding, type Keyboard } from './keyboard-context'

const samples = 5
const physicalHold = 25

function edits(event: KeyboardEvent) {
    return event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace'
}

/** Text entry keeps its own keys, and an open menu or list handles them first. */
function typing(target: EventTarget | null) {
    return (
        target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
            target.isContentEditable ||
            !!target.closest('[role=menu], [role=listbox]'))
    )
}

/** Android reports an empty code for on-screen keys. iOS reports the same values for both keyboards,
 * but its on-screen keyboard releases each key within a few milliseconds of pressing it.
 *
 * Bound shortcuts run in the capture phase, ahead of element handlers, and the latest binding of a
 * key wins. A late binding runs in the bubble phase instead, once whatever handled the key first
 * had the chance to claim it. */
export function KeyboardProvider({ children }: { children: ReactNode }) {
    const holds = useRef<number[]>([])
    const bindings = useRef<{ binding: KeyBinding; run: () => void }[]>([])
    useEffect(() => {
        const pressed = new Map<string, number>()
        const down = (event: KeyboardEvent) => {
            if (!event.repeat && edits(event)) pressed.set(event.code || event.key, event.timeStamp)
        }
        const up = (event: KeyboardEvent) => {
            const key = event.code || event.key
            const start = pressed.get(key)
            if (start === undefined) return
            pressed.delete(key)
            holds.current = [...holds.current.slice(1 - samples), event.timeStamp - start]
        }
        const phase = (late: boolean) => (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.isComposing) return
            const inText = typing(event.target)
            const bound = bindings.current.findLast(
                (entry) =>
                    !!entry.binding.late === late &&
                    (!inText || !!entry.binding.inText) &&
                    matchesKey(entry.binding, event),
            )
            if (!bound) return
            event.preventDefault()
            event.stopPropagation()
            bound.run()
        }
        const early = phase(false)
        const late = phase(true)
        document.addEventListener('keydown', down, true)
        document.addEventListener('keyup', up, true)
        window.addEventListener('keydown', early, true)
        window.addEventListener('keydown', late)
        return () => {
            document.removeEventListener('keydown', down, true)
            document.removeEventListener('keyup', up, true)
            window.removeEventListener('keydown', early, true)
            window.removeEventListener('keydown', late)
        }
    }, [])
    const [keyboard] = useState<Keyboard>(() => ({
        virtual(event) {
            if (event.code === '') return true
            const recent = holds.current
            if (!recent.length) return matchMedia('(pointer: coarse)').matches
            return recent.reduce((sum, hold) => sum + hold, 0) / recent.length < physicalHold
        },
        bind(binding, run) {
            const entry = { binding, run }
            bindings.current = [...bindings.current, entry]
            return () => {
                bindings.current = bindings.current.filter((item) => item !== entry)
            }
        },
    }))
    return <KeyboardContext value={keyboard}>{children}</KeyboardContext>
}
