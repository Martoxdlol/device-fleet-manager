type When = Date | string | number

const toDate = (value: When) => (value instanceof Date ? value : new Date(value))

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)

export function createFormat(tag: string) {
    const date = new Intl.DateTimeFormat(tag, { dateStyle: 'medium' })
    const time = new Intl.DateTimeFormat(tag, { timeStyle: 'short' })
    const dateTime = new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' })
    const monthDay = new Intl.DateTimeFormat(tag, { month: 'short', day: 'numeric' })
    const clock = new Intl.DateTimeFormat(tag, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
        hourCycle: 'h23',
    })
    const relative = new Intl.RelativeTimeFormat(tag, { numeric: 'auto', style: 'short' })
    const collator = new Intl.Collator(tag, { numeric: true })
    const number = (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(tag, options).format(value)

    return {
        tag,
        date: (value: When) => date.format(toDate(value)),
        time: (value: When) => time.format(toDate(value)),
        dateTime: (value: When) => dateTime.format(toDate(value)),
        monthDay: (value: When) => monthDay.format(toDate(value)),
        clock: (value: When) => clock.format(toDate(value)),
        number,
        money: (amount: number, currency?: string, scale = 2) =>
            number(
                amount,
                currency
                    ? { style: 'currency', currency }
                    : { minimumFractionDigits: scale, maximumFractionDigits: scale },
            ),
        bytes: (size: number) => {
            if (size < 1024) return `${number(size)} B`
            if (size < 1024 ** 2) return `${number(Math.round(size / 1024))} KB`
            if (size < 1024 ** 3)
                return `${number(size / 1024 ** 2, { maximumFractionDigits: 1 })} MB`
            return `${number(size / 1024 ** 3, { maximumFractionDigits: 2 })} GB`
        },
        duration: (ms: number) => {
            const unit = (value: number, unit: string) =>
                number(value, { style: 'unit', unit, unitDisplay: 'narrow' })
            const seconds = Math.max(0, Math.round(ms / 1000))
            if (seconds < 60) return unit(seconds, 'second')
            const minutes = Math.floor(seconds / 60)
            if (minutes < 60) return `${unit(minutes, 'minute')} ${unit(seconds % 60, 'second')}`
            return `${unit(Math.floor(minutes / 60), 'hour')} ${unit(minutes % 60, 'minute')}`
        },
        ago: (value: When) => {
            const at = toDate(value)
            const minutes = Math.floor((Date.now() - at.getTime()) / 60000)
            if (minutes < 1) return relative.format(0, 'second')
            if (minutes < 60) return relative.format(-minutes, 'minute')
            if (minutes < 60 * 24) return relative.format(-Math.floor(minutes / 60), 'hour')
            if (minutes < 60 * 24 * 7)
                return relative.format(-Math.floor(minutes / (60 * 24)), 'day')
            return monthDay.format(at)
        },
        day: (value: When) => {
            const at = toDate(value)
            const today = new Date()
            const yesterday = new Date(today)
            yesterday.setDate(today.getDate() - 1)
            if (at.toDateString() === today.toDateString())
                return capitalize(relative.format(0, 'day'))
            if (at.toDateString() === yesterday.toDateString())
                return capitalize(relative.format(-1, 'day'))
            return monthDay.format(at)
        },
        list: (items: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction') =>
            new Intl.ListFormat(tag, { type }).format(items),
        compare: collator.compare,
    }
}

export type Format = ReturnType<typeof createFormat>
