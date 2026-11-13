import { useEffect, useState } from 'react'

/** `value` once it has held still for `delay` milliseconds. */
export function useDebounced<T>(value: T, delay = 250) {
    const [settled, setSettled] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return settled
}
