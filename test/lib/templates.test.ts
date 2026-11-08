import { describe, expect, it } from "vite-plus/test"

import { renderTemplate } from "../../src/lib/template"
import { DEFAULT_TEMPLATE } from "../../src/lib/templates"
import type { ClipContext } from "../../src/shared/variables"

const CONTEXT: ClipContext = {
    url: "https://example.com/posts/hello",
    domain: "example.com",
    date: "2026-09-03T10:00:00.000Z",
    title: "Hello World",
    author: "Ada",
    description: "A post",
    content: "Body text",
    words: 2,
    language: "en",
    favicon: "https://example.com/favicon.ico",
    image: "https://cdn.example.com/cover.jpg",
    selection: "picked",
    highlights: [],
}

describe("DEFAULT_TEMPLATE", () => {
    it("renders the note name from the title", async () => {
        const rendered = await renderTemplate(DEFAULT_TEMPLATE.noteName, {
            variables: { ...CONTEXT },
        })
        expect(rendered).toBe("Hello World")
    })

    it("renders properties with variable values", async () => {
        const entries = await Promise.all(
            DEFAULT_TEMPLATE.properties.map(
                async (property) =>
                    [
                        property.name,
                        await renderTemplate(property.value, { variables: { ...CONTEXT } }),
                    ] as const,
            ),
        )
        const rendered = Object.fromEntries(entries)
        expect(rendered.title).toBe("Hello World")
        expect(rendered.source).toBe("https://example.com/posts/hello")
        expect(rendered.author).toBe("Ada")
        expect(rendered.created).toBe("2026-09-03T10:00:00.000Z")
        expect(rendered.description).toBe("A post")
        expect(rendered.image).toBe("https://cdn.example.com/cover.jpg")
        expect(rendered.tags).toBe("clips")
    })
})
