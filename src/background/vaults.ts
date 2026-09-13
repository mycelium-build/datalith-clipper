import type { ApiResult, Vault } from "../lib/api"
import type { VaultsResponse } from "../shared/messages"

export interface VaultsDeps {
    fetchVaults: () => Promise<ApiResult<Vault[]>>
    loadCache: () => Promise<Vault[]>
    saveCache: (vaults: Vault[]) => Promise<void>
}

/**
 * Live vault listing with a last-known-good fallback:
 * when Datalith is unreachable,
 * the vaults from the last successful sync keep the Panel usable
 * saving goes through the launch-and-retry pipeline.
 */
export async function resolveVaults(deps: VaultsDeps): Promise<VaultsResponse> {
    const result = await deps.fetchVaults()
    if (result.ok) {
        await deps.saveCache(result.data)
        return { ok: true, vaults: result.data }
    }
    if (result.kind === "unreachable") {
        const cached = await deps.loadCache()
        if (cached.length > 0) return { ok: true, vaults: cached, stale: true }
    }
    return { ok: false, error: result.error }
}
