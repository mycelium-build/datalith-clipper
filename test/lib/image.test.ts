import { parseHTML } from "linkedom"
import { describe, expect, it } from "vite-plus/test"

import { pickImage } from "../../src/lib/image"

const BASE = "https://example.com/article"

function doc(html: string): Document {
    return parseHTML(html).document
}

describe("pickImage", () => {
    it("prefers og:image", () => {
        const page = doc(
            `<meta property="og:image" content="https://cdn.example.com/cover.jpg">
             <img src="https://cdn.example.com/other.jpg" width="800" height="400">`,
        )
        expect(pickImage(page, undefined, BASE)).toBe("https://cdn.example.com/cover.jpg")
    })

    it("falls back to twitter:image", () => {
        const page = doc(`<meta name="twitter:image" content="https://cdn.example.com/tw.jpg">`)
        expect(pickImage(page, undefined, BASE)).toBe("https://cdn.example.com/tw.jpg")
    })

    it("uses the defuddle image when it passes the filter", () => {
        const page = doc(`<img src="https://cdn.example.com/small.jpg" width="100" height="50">`)
        expect(pickImage(page, "https://cdn.example.com/big.jpg", BASE)).toBe(
            "https://cdn.example.com/big.jpg",
        )
    })

    it("rejects extracted images that look like logos", () => {
        const page = doc(`<img src="https://cdn.example.com/pic.jpg" width="900" height="500">`)
        expect(pickImage(page, "https://cdn.example.com/logo.jpg", BASE)).toBe(
            "https://cdn.example.com/pic.jpg",
        )
    })

    it("scans images in DOM order and skips small ones", () => {
        const page = doc(
            `<img src="https://cdn.example.com/tiny.jpg" width="100" height="60">
             <img src="https://cdn.example.com/wide.jpg" width="900" height="500">
             <img src="https://cdn.example.com/next.jpg" width="800" height="600">`,
        )
        expect(pickImage(page, undefined, BASE)).toBe("https://cdn.example.com/wide.jpg")
    })

    it("skips images with logo or avatar hints", () => {
        const page = doc(
            `<img src="https://cdn.example.com/banner.png" class="site-logo" width="800" height="400">
             <img src="https://cdn.example.com/portrait.jpg" alt="avatar" width="800" height="400">
             <img src="https://cdn.example.com/real.jpg" width="800" height="400">`,
        )
        expect(pickImage(page, undefined, BASE)).toBe("https://cdn.example.com/real.jpg")
    })

    it("skips data URIs and svg sources", () => {
        const page = doc(
            `<img src="data:image/png;base64,AAAA" width="800" height="400">
             <img src="https://cdn.example.com/graph.svg" width="800" height="400">
             <img src="https://cdn.example.com/photo.jpg" width="800" height="400">`,
        )
        expect(pickImage(page, undefined, BASE)).toBe("https://cdn.example.com/photo.jpg")
    })

    it("rejects extreme aspect ratios", () => {
        const page = doc(
            `<img src="https://cdn.example.com/strip.jpg" width="1000" height="60">
             <img src="https://cdn.example.com/ok.jpg" width="800" height="500">`,
        )
        expect(pickImage(page, undefined, BASE)).toBe("https://cdn.example.com/ok.jpg")
    })

    it("accepts images with unknown dimensions", () => {
        const page = doc(`<img src="https://cdn.example.com/no-size.jpg">`)
        expect(pickImage(page, undefined, BASE)).toBe("https://cdn.example.com/no-size.jpg")
    })

    it("absolutizes relative sources", () => {
        const page = doc(`<img src="/img/cover.jpg" width="800" height="400">`)
        expect(pickImage(page, undefined, BASE)).toBe("https://example.com/img/cover.jpg")
    })

    it("returns empty when nothing qualifies", () => {
        const page = doc(`<img src="https://cdn.example.com/icon.png" class="icon">`)
        expect(pickImage(page, undefined, BASE)).toBe("")
    })
})
