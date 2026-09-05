import { describe, expect, it } from "vitest"

import { renderWikilinkEmbeds } from "../../src/lib/markdown"

describe("renderWikilinkEmbeds", () => {
    it("converts image embeds with http urls into img tags", () => {
        expect(renderWikilinkEmbeds("![[https://example.com/cover.jpg]]")).toBe(
            '<img src="https://example.com/cover.jpg" alt="https://example.com/cover.jpg">',
        )
    })

    it("converts image extension embeds into img tags", () => {
        expect(renderWikilinkEmbeds("![[assets/picture.png|Cover]]")).toBe(
            '<img src="assets/picture.png" alt="Cover">',
        )
    })

    it("renders non-image embeds as a placeholder chip", () => {
        expect(renderWikilinkEmbeds("![[My Note]]")).toBe(
            '<span class="wikilink-embed">My Note</span>',
        )
    })

    it("escapes html in targets and labels", () => {
        const html = renderWikilinkEmbeds('![[<script>alert(1)</script>|a"b]]')
        expect(html).toBe(
            '<span class="wikilink-embed">&lt;script&gt;alert(1)&lt;/script&gt;</span>',
        )
    })

    it("leaves regular markdown untouched", () => {
        const markdown = "# Title\n\n- item with [[a link]]\n"
        expect(renderWikilinkEmbeds(markdown)).toBe(markdown)
    })
})
