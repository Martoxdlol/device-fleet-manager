export const sides = ['top', 'right', 'bottom', 'left'] as const
export type Side = (typeof sides)[number]
export type SlotId = `${'fixed' | 'floating'}-${Side}`
export type Insets = Record<Side, number>
export type Sizes = Partial<Record<SlotId, { width: number; height: number }>>
export function getInsets(sizes: Sizes) {
    const read = (kind: 'fixed' | 'floating') =>
        Object.fromEntries(
            sides.map((side) => [
                side,
                sizes[`${kind}-${side}`]?.[
                    side === 'left' || side === 'right' ? 'width' : 'height'
                ] ?? 0,
            ]),
        ) as Insets
    const fixed = read('fixed')
    const floating = read('floating')
    const content = Object.fromEntries(
        sides.map((side) => [side, fixed[side] + floating[side]]),
    ) as Insets
    return { fixed, floating, content }
}
