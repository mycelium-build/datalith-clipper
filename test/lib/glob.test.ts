import { describe, expect, it } from "vite-plus/test"

import { matchAnyGlob, matchGlob } from "../../src/lib/glob"

describe("matchGlob", () => {
    it("matches with * wildcards", () => {
        expect(matchGlob("https://github.com/foo/pulls", "github.com/*/pulls")).toBe(true)
        expect(matchGlob("https://github.com/foo/issues", "github.com/*/pulls")).toBe(false)
    })

    it("matches the full URL", () => {
        expect(matchGlob("https://docs.example.com/guide/intro", "docs.example.com/guide/*")).toBe(
            true,
        )
        expect(matchGlob("https://docs.example.com/api/intro", "docs.example.com/guide/*")).toBe(
            false,
        )
    })

    it("is case-insensitive", () => {
        expect(matchGlob("https://GitHub.com/x", "github.com/x")).toBe(true)
    })

    it("treats regex characters literally", () => {
        expect(matchGlob("https://example.com/a.b+c", "example.com/a.b+c")).toBe(true)
    })

    it("never matches empty patterns", () => {
        expect(matchGlob("https://example.com", "")).toBe(false)
        expect(matchGlob("https://example.com", "   ")).toBe(false)
    })
})

describe("matchAnyGlob", () => {
    it("matches when any line matches", () => {
        const patterns = "arxiv.org/abs/*\ngithub.com/*/releases"
        expect(matchAnyGlob("https://arxiv.org/abs/2401.0001", patterns)).toBe(true)
        expect(matchAnyGlob("https://github.com/x/releases", patterns)).toBe(true)
        expect(matchAnyGlob("https://example.com", patterns)).toBe(false)
    })
})
