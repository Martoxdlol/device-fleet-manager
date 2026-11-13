import { useNavigate, useSearchParams, type NavigateOptions } from 'react-router'

export const AUTH_USER_PARAM = 'authuser'

export function parseAuthUser(raw: string | null) {
    if (raw === null || !/^\d+$/.test(raw)) return null
    return Number(raw)
}

export function carryAuthUser(to: string, authuser: string | null) {
    const [path, search = ''] = to.split('?')
    const params = new URLSearchParams(search)
    if (authuser === null) params.delete(AUTH_USER_PARAM)
    else params.set(AUTH_USER_PARAM, authuser)
    const query = params.toString()
    return query ? `${path}?${query}` : path
}

export function useAuthUserParam() {
    const [params] = useSearchParams()
    return params.get(AUTH_USER_PARAM)
}

export function useCarry() {
    const authuser = useAuthUserParam()
    return (to: string) => (to.startsWith('/') ? carryAuthUser(to, authuser) : to)
}

export function useAppNavigate() {
    const navigate = useNavigate()
    const carry = useCarry()
    return (to: string, options?: NavigateOptions) => navigate(carry(to), options)
}

const MAX_RETURN_TO = 1024

const forbidden = (char: string) => {
    const code = char.charCodeAt(0)
    return char === '\\' || code < 0x20 || (code >= 0x7f && code <= 0x9f)
}

export function safeReturnTo(value: string | null | undefined) {
    return value &&
        value.startsWith('/') &&
        !value.startsWith('//') &&
        new TextEncoder().encode(value).length <= MAX_RETURN_TO &&
        ![...value].some(forbidden)
        ? value
        : '/'
}

export interface LoginState {
    returnTo: string
}
