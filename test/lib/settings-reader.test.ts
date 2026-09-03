import { describe, expect, it } from "vitest"

import { DEFAULT_SETTINGS, mergeDefaults } from "../../src/lib/settings-schema"

describe("reader settings", () => {
    it("defaults to system font, 16px, 1.6 line height, plain links", () => {
        expect(DEFAULT_SETTINGS.reader).toEqual({
            font: "",
            fontSize: 16,
            lineHeight: 1.6,
            colorLinks: false,
        })
    })

    it("merges partial reader settings", () => {
        const merged = mergeDefaults({ reader: { fontSize: 20 } } as never)
        expect(merged.reader).toEqual({
            font: "",
            fontSize: 20,
            lineHeight: 1.6,
            colorLinks: false,
        })
    })

    it("rejects invalid numbers", () => {
        const merged = mergeDefaults({
            reader: { fontSize: Number.NaN, lineHeight: Number.POSITIVE_INFINITY },
        } as never)
        expect(merged.reader.fontSize).toBe(16)
        expect(merged.reader.lineHeight).toBe(1.6)
    })
})
