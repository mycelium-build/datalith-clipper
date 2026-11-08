import { describe, expect, it, vi } from "vite-plus/test"

import { resolveVaults, type VaultsDeps } from "../../src/background/vaults"
import type { ApiResult, Vault } from "../../src/lib/api"

const VAULTS: Vault[] = [
    { name: "Main", path: "/vaults/main" },
    { name: "Work", path: "/vaults/work" },
]

function deps(result: ApiResult<Vault[]>, cached: Vault[] = [], saved: Vault[][] = []): VaultsDeps {
    return {
        fetchVaults: vi.fn(async () => result),
        loadCache: vi.fn(async () => cached),
        saveCache: vi.fn(async (vaults: Vault[]) => {
            saved.push(vaults)
        }),
    }
}

describe("resolveVaults", () => {
    it("returns live vaults and refreshes the cache", async () => {
        const saved: Vault[][] = []
        const response = await resolveVaults(deps({ ok: true, data: VAULTS }, [], saved))
        expect(response).toEqual({ ok: true, vaults: VAULTS })
        expect(saved).toEqual([VAULTS])
    })

    it("falls back to the cache when Datalith is unreachable", async () => {
        const response = await resolveVaults(
            deps({ ok: false, error: "Datalith is unreachable", kind: "unreachable" }, VAULTS),
        )
        expect(response).toEqual({ ok: true, vaults: VAULTS, stale: true })
    })

    it("reports the error when unreachable and nothing is cached", async () => {
        const response = await resolveVaults(
            deps({ ok: false, error: "Datalith is unreachable", kind: "unreachable" }),
        )
        expect(response).toEqual({ ok: false, error: "Datalith is unreachable" })
    })

    it("never falls back to the cache for HTTP errors", async () => {
        const response = await resolveVaults(
            deps({ ok: false, error: "401 Unauthorized", kind: "http" }, VAULTS),
        )
        expect(response).toEqual({ ok: false, error: "401 Unauthorized" })
    })
})
