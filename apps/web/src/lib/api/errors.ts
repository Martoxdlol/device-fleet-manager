import type { Catalog } from '../../i18n/catalog'

export interface ApiError {
    error: string
    message: string
    details?: { field: string; message: string }[]
}

export function isApiError(error: unknown): error is ApiError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'error' in error &&
        typeof error.error === 'string' &&
        'message' in error &&
        typeof error.message === 'string'
    )
}

export function errorMessage(error: unknown, t: Catalog) {
    return isApiError(error) ? error.message : t.common.couldNotConnect
}

export function fieldError(error: unknown, field: string) {
    if (!isApiError(error)) return undefined
    return error.details?.find((detail) => detail.field === field)?.message
}

export function retryQuery(failureCount: number, error: unknown) {
    if (failureCount >= 2) return false
    return (
        !isApiError(error) ||
        ['internal_error', 'unavailable', 'rate_limited'].includes(error.error)
    )
}
