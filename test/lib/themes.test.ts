import { describe, expect, it } from "vitest"

import { slug, translateTheme } from "../../scripts/lib/themes.ts"

describe("slug", () => {
    it("slugs theme names", () => {
        expect(slug("Datalith Light")).toBe("datalith-light")
        expect(slug("Catppuccin Mocha")).toBe("catppuccin-mocha")
    })
})

describe("translateTheme", () => {
    it("maps the Datalith Light palette onto --dl-* tokens", () => {
        const variables = translateTheme(
            {
                name: "Datalith Light",
                colors: {
                    "primary.background": "#1e8dff",
                    "primary.foreground": "#FFFFFF",
                    background: "#F9F9F9",
                    foreground: "#000000",
                    border: "#D2D2D2",
                    "base.red": "#d21f07",
                },
            },
            "light",
        )
        expect(variables.mode).toBe("light")
        expect(variables["--dl-bg"]).toBe("#F9F9F9")
        expect(variables["--dl-fg"]).toBe("#000000")
        expect(variables["--dl-accent"]).toBe("#1e8dff")
        expect(variables["--dl-accent-fg"]).toBe("#FFFFFF")
        expect(variables["--dl-border"]).toBe("#D2D2D2")
        expect(variables["--dl-red"]).toBe("#d21f07")
    })

    it("falls back to mode-appropriate defaults", () => {
        const variables = translateTheme({ name: "Unknown" }, "dark")
        expect(variables["--dl-bg"]).toBe("#131313")
        expect(variables["--dl-fg"]).toBe("#dedede")
        expect(variables["--dl-accent"]).toBe("#1e8dff")
    })

    it("derives logo colors from the accent", () => {
        const variables = translateTheme(
            { name: "Datalith Dark", colors: { "primary.background": "#000000" } },
            "dark",
        )
        expect(variables["--dl-logo-1"]).toMatch(/^#[0-9a-f]{6}$/)
        expect(variables["--dl-logo-1"]).not.toBe("#000000")
    })
})
