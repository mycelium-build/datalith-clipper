import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { Defuddle } from "defuddle/node"
import { parseHTML } from "linkedom"
import { describe, expect, it } from "vite-plus/test"

import { buildContext } from "../../src/lib/extract"

const URL_SOURCE = "https://www.example.com/posts/sample-article"

async function parseFixture(): Promise<{ document: Document; html: string }> {
    const file = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "fixtures",
        "article.html",
    )
    const html = await readFile(file, "utf8")
    const { document } = parseHTML(html)
    return { document: document, html }
}

describe("buildContext", () => {
    it("builds a clip context from a defuddle parse", async () => {
        const { document, html } = await parseFixture()
        const parsed = await Defuddle(html, URL_SOURCE, { markdown: true })
        const context = buildContext(document, URL_SOURCE, parsed, {
            selection: "picked text",
            highlights: ["highlight one"],
        })

        expect(context.url).toBe(URL_SOURCE)
        expect(context.domain).toBe("www.example.com")
        expect(context.title).toContain("Sample Article")
        expect(context.author).toContain("Ada Lovelace")
        expect(context.description).toContain("sample article")
        expect(context.content).toContain("opening paragraph")
        expect(context.content).not.toContain("Footer content")
        expect(context.words).toBeGreaterThan(0)
        expect(context.language).toBe("en")
        expect(context.image).toBe("https://cdn.example.com/og.jpg")
        expect(context.favicon).toBe("https://www.example.com/favicon-site.ico")
        expect(context.selection).toBe("picked text")
        expect(context.highlights).toEqual(["highlight one"])
        expect(context.date).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/))
    })

    it("falls back to document language and derived word counts", async () => {
        const { document, html } = await parseFixture()
        const parsed = await Defuddle(html, URL_SOURCE)
        const context = buildContext(document, URL_SOURCE, { ...parsed, wordCount: undefined })
        expect(context.language).toBe("en")
        expect(context.words).toBeGreaterThan(0)
        expect(context.selection).toBe("")
        expect(context.highlights).toEqual([])
    })

    it("survives an invalid base URL", () => {
        const { document } = parseHTML("<html lang='fr'><body></body></html>")
        const context = buildContext(document, "not a url", {
            title: "T",
        })
        expect(context.domain).toBe("example.invalid")
        expect(context.title).toBe("T")
    })
})
