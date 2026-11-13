import type { KeyBinding } from '../core/keyboard/keyboard-context'

export const apple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

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
