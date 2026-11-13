import type { KeyBinding } from '../core/keyboard/keyboard-context'

/** Apple platforms put Command and Option where others put Ctrl and Alt. */
export const apple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** The names a key is written with where the platform spells it out. */
export interface KeyNames {
    enter: string
    delete: string
    shift: string
}

const symbols: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Backspace: '⌫',
}

/** A key as the platform's menus write it: ⌘⌫ on macOS, Ctrl+X or Del elsewhere. */
export function keyLabel(binding: KeyBinding, names: KeyNames) {
    const key =
        binding.key === 'Enter'
            ? names.enter
            : binding.key === 'Delete'
              ? names.delete
              : (symbols[binding.key] ??
                (binding.key.length === 1 ? binding.key.toUpperCase() : binding.key))
    if (apple)
        return [
            binding.ctrl && '⌃',
            binding.alt && '⌥',
            binding.shift && '⇧',
            binding.meta && '⌘',
            key,
        ]
            .filter(Boolean)
            .join('')
    return [binding.ctrl && 'Ctrl', binding.alt && 'Alt', binding.shift && names.shift, key]
        .filter(Boolean)
        .join('+')
}
