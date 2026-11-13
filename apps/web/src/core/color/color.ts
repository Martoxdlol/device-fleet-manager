export function parseHex(value: string) {
    const digits = value.trim().replace(/^#/, '').toLowerCase()
    if (/^[0-9a-f]{6}$/.test(digits)) return `#${digits}`
    if (/^[0-9a-f]{3}$/.test(digits)) return `#${[...digits].map((d) => d + d).join('')}`
    return null
}

export function channels(hex: string) {
    const value = Number.parseInt(hex.slice(1), 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function luminance(hex: string) {
    const [r, g, b] = channels(hex).map((channel) => {
        const c = channel / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const dark = '#171717'
const light = '#ffffff'

export function inkOn(hex: string) {
    const background = luminance(hex)
    const withLight = 1.05 / (background + 0.05)
    const withDark = (background + 0.05) / (luminance(dark) + 0.05)
    return withLight >= withDark ? light : dark
}
