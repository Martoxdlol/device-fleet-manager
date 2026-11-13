function base64url(bytes: ArrayBuffer | Uint8Array) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    let binary = ''
    for (const byte of view) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomVerifier() {
    return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function challenge(verifier: string) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
    return base64url(digest)
}
