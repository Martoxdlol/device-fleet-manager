import {
    createContext,
    useContext,
    useEffect,
    useRef,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

export type KeyBinding = {
    key: string
    meta?: boolean
    alt?: boolean
    ctrl?: boolean
    shift?: boolean
    late?: boolean
    inText?: boolean
}

export function matchesKey(
    binding: KeyBinding,
    event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'altKey' | 'ctrlKey' | 'shiftKey'>,
) {
    return (
        event.key === binding.key &&
        event.metaKey === !!binding.meta &&
        event.altKey === !!binding.alt &&
        event.ctrlKey === !!binding.ctrl &&
        event.shiftKey === !!binding.shift
    )
}

export type Keyboard = {
    virtual(event: KeyboardEvent): boolean
    bind(binding: KeyBinding, run: () => void): () => void
}

export const KeyboardContext = createContext<Keyboard | null>(null)

export function useKeyboard() {
    const value = useContext(KeyboardContext)
    if (!value) throw new Error('useKeyboard requires KeyboardProvider')
    return value
}

export function useShortcut(binding: KeyBinding | undefined, run: () => void) {
    const keyboard = useKeyboard()
    const latest = useRef(run)
    useEffect(() => {
        latest.current = run
    })
    const { key, meta, alt, ctrl, shift, late, inText } = binding ?? {}
    useEffect(() => {
        if (!key) return
        return keyboard.bind({ key, meta, alt, ctrl, shift, late, inText }, () => latest.current())
    }, [keyboard, key, meta, alt, ctrl, shift, late, inText])
}

export function useEnterSends() {
    const keyboard = useKeyboard()
    return (event: ReactKeyboardEvent) =>
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing &&
        (event.metaKey || event.ctrlKey || !keyboard.virtual(event.nativeEvent))
}
