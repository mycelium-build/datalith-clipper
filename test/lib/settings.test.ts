import { describe, expect, it } from "vitest"

import { DEFAULT_SETTINGS, mergeDefaults } from "../../src/lib/settings-schema"

describe("mergeDefaults", () => {
    it("returns defaults when nothing is stored", () => {
        expect(mergeDefaults(undefined)).toEqual(DEFAULT_SETTINGS)
    })

    it("fills missing sections from defaults", () => {
        const merged = mergeDefaults({
            connection: { baseUrl: "http://127.0.0.1:1234", token: "" },
        })
        expect(merged.connection.baseUrl).toBe("http://127.0.0.1:1234")
        expect(merged.appearance.mode).toBe("auto")
        expect(merged.behavior.saveWithoutOpening).toBe(true)
        expect(merged.lastUsed.templateId).toBe("default")
    })

    it("merges partial nested sections", () => {
        const merged = mergeDefaults({
            appearance: { mode: "dark", light: "", dark: "matrix" },
        })
        expect(merged.appearance.mode).toBe("dark")
        expect(merged.appearance.light).toBe("datalith-light")
        expect(merged.appearance.dark).toBe("matrix")
    })
})
