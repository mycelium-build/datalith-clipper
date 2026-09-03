import browser from "webextension-polyfill"

import { mergeDefaults, type ClipperSettings } from "./settings-schema"

export async function loadSettings(): Promise<ClipperSettings> {
    const stored = await browser.storage.local.get("settings")
    return mergeDefaults(stored.settings as Partial<ClipperSettings> | undefined)
}

export async function saveSettings(settings: ClipperSettings): Promise<void> {
    await browser.storage.local.set({ settings })
}
