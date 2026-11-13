import {
    createContext,
    useContext,
    useEffect,
    useRef,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

/** A key with the exact modifiers held. Unnamed modifiers must be up. */
export type KeyBinding = {
    key: string
    meta?: boolean
    alt?: boolean
    ctrl?: boolean
    shift?: boolean
    /** Runs after the focused element and open overlays had the key, so a dialog closes first. */
    late?: boolean
    /** Runs while text entry has focus too: for chords no field types, such as Cmd/Ctrl+J. */
    inText?: boolean
}

/** Whether the event is the binding's key with exactly its modifiers. */
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
    /** Runs `run` on a matching keydown outside text entry and open menus, unless the binding
     * says `inText`. Returns the unbind. */
    bind(binding: KeyBinding, run: () => void): () => void
}

export const KeyboardContext = createContext<Keyboard | null>(null)

export function useKeyboard() {
    const value = useContext(KeyboardContext)
    if (!value) throw new Error('useKeyboard requires KeyboardProvider')
    return value
}

/** A shortcut bound while the component is mounted. No binding binds nothing. */
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

/** Physical keyboards send on Enter and add a line on Shift+Enter. On-screen keyboards add a line. */
export function useEnterSends() {
    const keyboard = useKeyboard()
    return (event: ReactKeyboardEvent) =>
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing &&
        (event.metaKey || event.ctrlKey || !keyboard.virtual(event.nativeEvent))
}
