type When = Date | string | number

const toDate = (value: When) => (value instanceof Date ? value : new Date(value))

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)

/** Dates, numbers, sizes, durations, lists and sorting in one formatting locale, such as `es-US`. */
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
        /** `12:04:31.204`, for log lines. */
        clock: (value: When) => clock.format(toDate(value)),
        number,
        /** An amount in a currency, or with `scale` decimals when there is none. */
        money: (amount: number, currency?: string, scale = 2) =>
            number(
                amount,
                currency
                    ? { style: 'currency', currency }
                    : { minimumFractionDigits: scale, maximumFractionDigits: scale },
            ),
        /** `512 B`, `12 KB`, `3.4 MB`, `1.25 GB`, with the locale's decimal separator. */
        bytes: (size: number) => {
            if (size < 1024) return `${number(size)} B`
            if (size < 1024 ** 2) return `${number(Math.round(size / 1024))} KB`
            if (size < 1024 ** 3)
                return `${number(size / 1024 ** 2, { maximumFractionDigits: 1 })} MB`
            return `${number(size / 1024 ** 3, { maximumFractionDigits: 2 })} GB`
        },
        /** `42s`, `3m 5s`, `2h 10m`. */
        duration: (ms: number) => {
            const unit = (value: number, unit: string) =>
                number(value, { style: 'unit', unit, unitDisplay: 'narrow' })
            const seconds = Math.max(0, Math.round(ms / 1000))
            if (seconds < 60) return unit(seconds, 'second')
            const minutes = Math.floor(seconds / 60)
            if (minutes < 60) return `${unit(minutes, 'minute')} ${unit(seconds % 60, 'second')}`
            return `${unit(Math.floor(minutes / 60), 'hour')} ${unit(minutes % 60, 'minute')}`
        },
        /** `now`, `12 min ago`, `3 hr ago`, `2 days ago`, then the month and day. */
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
        /** `Today`, `Yesterday` or the month and day. */
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
        /** `a, b and c`, or `a, b or c`. */
        list: (items: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction') =>
            new Intl.ListFormat(tag, { type }).format(items),
        compare: collator.compare,
    }
}

export type Format = ReturnType<typeof createFormat>
