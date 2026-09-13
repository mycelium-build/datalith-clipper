import browser from "webextension-polyfill"

import type { Vault } from "./api"

const KEY = "vaultCache"

export async function saveVaultCache(vaults: Vault[]): Promise<void> {
    await browser.storage.local.set({ [KEY]: { vaults, savedAt: Date.now() } })
}

export async function loadVaultCache(): Promise<Vault[]> {
    const stored = (await browser.storage.local.get(KEY)) as {
        vaultCache?: { vaults?: Vault[] }
    }
    const vaults = stored.vaultCache?.vaults
    return Array.isArray(vaults) ? vaults : []
}
