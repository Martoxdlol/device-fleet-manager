/**
 * The browser's drag image is a snapshot of the dragged element, which for a full width table
 * row is a smear of empty cells. This draws a chip instead and removes it a frame later, once
 * the browser has taken its picture.
 */
export function chipDragImage(transfer: DataTransfer, label: string, count: number) {
    const chip = document.createElement('div')
    chip.className =
        'drag-chip pointer-events-none fixed top-0 left-[-1000px] z-50 flex max-w-60 items-center gap-2 border border-primary bg-card px-2.5 py-1.5 text-xs text-foreground shadow-lg'
    const name = document.createElement('span')
    name.className = 'truncate'
    name.textContent = label
    chip.append(name)
    if (count > 1) {
        const badge = document.createElement('span')
        badge.className =
            'bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground tabular-nums'
        badge.textContent = String(count)
        chip.append(badge)
    }
    document.body.append(chip)
    transfer.setDragImage(chip, 12, 12)
    requestAnimationFrame(() => chip.remove())
}
