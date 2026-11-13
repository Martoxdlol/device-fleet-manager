import { createClient, type Client } from '@fleet/client'
import { browserLanguage } from '../i18n/languages'

export function apiClient(
    baseUrl: string,
    token?: () => string | undefined,
    language: () => string = browserLanguage,
): Client {
    const client = createClient({ baseUrl, auth: token })
    client.interceptors.request.use((request) => {
        request.headers.set('Accept-Language', language())
        return request
    })
    return client
}

export const maxAccounts = 1
