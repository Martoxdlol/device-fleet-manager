import { channels } from '../core/color/color'

export const ORG_COLORS = [
    { hex: '#b14d51', name: 'red' },
    { hex: '#a16100', name: 'amber' },
    { hex: '#448335', name: 'green' },
    { hex: '#00896d', name: 'teal' },
    { hex: '#0083a0', name: 'cyan' },
    { hex: '#3772bb', name: 'blue' },
    { hex: '#7860b5', name: 'violet' },
    { hex: '#9e518f', name: 'pink' },
] as const

export function toneBackground(fill: string) {
    return `linear-gradient(100deg in oklab, ${fill} 0%, ${fill} 35%, var(--card) 85%)`
}

export interface Hsv {
    h: number
    s: number
    v: number
}

export function hexToHsv(hex: string): Hsv {
    const [r, g, b] = channels(hex).map((channel) => channel / 255)
    const max = Math.max(r, g, b)
    const delta = max - Math.min(r, g, b)
    let h = 0
    if (delta) {
        if (max === r) h = ((g - b) / delta) % 6
        else if (max === g) h = (b - r) / delta + 2
        else h = (r - g) / delta + 4
    }
    return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max }
}

export function hsvToHex({ h, s, v }: Hsv) {
    const f = (n: number) => {
        const k = (n + h / 60) % 6
        const channel = v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
        return Math.round(channel * 255)
            .toString(16)
            .padStart(2, '0')
    }
    return `#${f(5)}${f(3)}${f(1)}`
}
