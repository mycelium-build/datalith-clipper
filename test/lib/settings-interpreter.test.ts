import { describe, expect, it } from "vitest"

import { DEFAULT_SETTINGS, mergeDefaults } from "../../src/lib/settings-schema"
import { DEFAULT_TEMPLATE, resolveTemplates } from "../../src/lib/templates"
import { exportPayload, importSettings } from "../../src/options/state"

describe("interpreter settings", () => {
    it("defaults to disabled with no providers or models", () => {
        expect(DEFAULT_SETTINGS.interpreter).toEqual({
            enabled: false,
            selectedModelId: "",
            providers: [],
            models: [],
            context: "",
        })
    })

    it("keeps stored providers and models verbatim", () => {
        const providers = [{ id: "p1", baseUrl: "https://api.example.com/v1", apiKey: "sk-1" }]
        const models = [{ id: "m1", name: "Test", modelId: "test-model", providerId: "p1" }]
        const merged = mergeDefaults({
            interpreter: {
                enabled: true,
                selectedModelId: "m1",
                providers,
                models,
                context: "ctx",
            },
        })
        expect(merged.interpreter.providers).toEqual(providers)
        expect(merged.interpreter.models).toEqual(models)
        expect(merged.interpreter.enabled).toBe(true)
        expect(merged.interpreter.context).toBe("ctx")
    })
})

describe("templates storage", () => {
    it("falls back to the seeded default when nothing is stored", () => {
        expect(resolveTemplates([])).toEqual([DEFAULT_TEMPLATE])
        expect(resolveTemplates(DEFAULT_SETTINGS.templates)).toEqual([DEFAULT_TEMPLATE])
    })

    it("uses stored templates when present", () => {
        const stored = [{ ...DEFAULT_TEMPLATE, id: "default", name: "Custom" }]
        expect(resolveTemplates(stored)[0].name).toBe("Custom")
    })
})

describe("export / import", () => {
    it("round-trips settings through export and import", () => {
        const settings = mergeDefaults({
            appearance: { mode: "dark", light: "", dark: "matrix" },
            interpreter: {
                enabled: true,
                selectedModelId: "m1",
                providers: [{ id: "p1", baseUrl: "https://x", apiKey: "" }],
                models: [],
                context: "be brief",
            },
            templates: [{ ...DEFAULT_TEMPLATE, name: "Mine" }],
        })
        const restored = importSettings(JSON.parse(exportPayload({ settings })))
        expect(restored).toEqual(settings)
    })

    it("accepts a bare settings object without the wrapper", () => {
        const restored = importSettings({
            appearance: { mode: "light", light: "ayu-light", dark: "" },
        })
        expect(restored.appearance.mode).toBe("light")
        expect(restored.appearance.light).toBe("ayu-light")
    })

    it("falls back to defaults for invalid input", () => {
        expect(importSettings(null)).toEqual(DEFAULT_SETTINGS)
        expect(importSettings("nope")).toEqual(DEFAULT_SETTINGS)
    })
})
