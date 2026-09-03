const BAD_IMAGE_PATTERN = /logo|icon|sprite|avatar|badge|button/i
const MIN_WIDTH = 250
const MIN_HEIGHT = 150
const MIN_ASPECT = 0.4
const MAX_ASPECT = 2.5

export function pickImage(
    doc: Document,
    extractedImage: string | undefined,
    baseUrl: string,
): string {
    const metaCandidates = [
        metaContent(doc, 'meta[property="og:image"]'),
        metaContent(doc, 'meta[name="twitter:image"]'),
        extractedImage,
    ]
    for (const candidate of metaCandidates) {
        const resolved = resolveCandidate(candidate, baseUrl)
        if (resolved) return resolved
    }
    for (const img of doc.querySelectorAll("img")) {
        const src = img.getAttribute("src") ?? ""
        if (!src || isBadImage(src, img)) continue
        if (!passesSize(img)) continue
        const resolved = resolveCandidate(src, baseUrl)
        if (resolved) return resolved
    }
    return ""
}

function metaContent(doc: Document, selector: string): string | undefined {
    return doc.querySelector(selector)?.getAttribute("content") ?? undefined
}

function resolveCandidate(candidate: string | undefined, baseUrl: string): string | null {
    if (!candidate || candidate.startsWith("data:")) return null
    try {
        const url = new URL(candidate, baseUrl)
        if (url.pathname.endsWith(".svg")) return null
        if (BAD_IMAGE_PATTERN.test(url.pathname)) return null
        return url.href
    } catch {
        return null
    }
}

function isBadImage(src: string, img: Element): boolean {
    if (src.startsWith("data:")) return true
    const haystack = `${src} ${img.className} ${img.id} ${img.getAttribute("alt") ?? ""}`
    return BAD_IMAGE_PATTERN.test(haystack)
}

function passesSize(img: Element): boolean {
    const width = dimension(img, "naturalWidth") ?? dimension(img, "width")
    const height = dimension(img, "naturalHeight") ?? dimension(img, "height")
    if (width === null || height === null) return true
    if (width < MIN_WIDTH || height < MIN_HEIGHT) return false
    const aspect = width / height
    return aspect >= MIN_ASPECT && aspect <= MAX_ASPECT
}

function dimension(img: Element, name: string): number | null {
    const value = Number(
        (img as unknown as Record<string, unknown>)[name] ?? img.getAttribute(name.toLowerCase()),
    )
    return Number.isFinite(value) && value > 0 ? value : null
}
