import { describe, expect, it } from "vitest"

import {
    DEFAULT_SETTINGS,
    mergeDefaults,
    readerStyleVars,
    type ClipperSettings,
} from "../../src/lib/settings-schema"

function settings(overrides: Partial<ClipperSettings["reader"]>): ClipperSettings {
    return mergeDefaults({ reader: { ...DEFAULT_SETTINGS.reader, ...overrides } })
}

describe("readerStyleVars", () => {
    it("uses the system stack when no font is set", () => {
        const vars = readerStyleVars(settings({}))
        expect(vars["--reader-font"]).toBe('system-ui, "Segoe UI", Roboto, sans-serif')
        expect(vars["--reader-size"]).toBe("16px")
        expect(vars["--reader-line-height"]).toBe("1.6")
        expect(vars["--reader-link-color"]).toBe("inherit")
    })

    it("applies a custom font stack", () => {
        const vars = readerStyleVars(settings({ font: 'Georgia, "Times New Roman", serif' }))
        expect(vars["--reader-font"]).toBe('Georgia, "Times New Roman", serif')
    })

    it("colors links with the accent when enabled", () => {
        const vars = readerStyleVars(settings({ colorLinks: true, fontSize: 18, lineHeight: 2 }))
        expect(vars["--reader-link-color"]).toBe("var(--dl-accent)")
        expect(vars["--reader-size"]).toBe("18px")
        expect(vars["--reader-line-height"]).toBe("2")
    })
})
