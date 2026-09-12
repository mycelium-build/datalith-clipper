import browser from "webextension-polyfill"

function originPattern(baseUrl: string): string | null {
    try {
        return `${new URL(baseUrl.trim()).origin}/*`
    } catch {
        return null
    }
}

export async function requestOriginPermission(baseUrl: string): Promise<void> {
    const origin = originPattern(baseUrl)
    if (!origin) return
    try {
        await browser.permissions.request({ origins: [origin] })
    } catch {
        // Invalid URL or permission denied
    }
}

export async function hasOriginPermission(baseUrl: string): Promise<boolean> {
    const origin = originPattern(baseUrl)
    if (!origin) return false
    try {
        return await browser.permissions.contains({ origins: [origin] })
    } catch {
        return false
    }
}
