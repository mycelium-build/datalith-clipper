import browser from "webextension-polyfill"

export async function requestOriginPermission(baseUrl: string): Promise<void> {
    try {
        const origin = `${new URL(baseUrl.trim()).origin}/*`
        await browser.permissions.request({ origins: [origin] })
    } catch {
        // Invalid URL or permission denied
    }
}
