import Defuddle from "defuddle"

import type { ClipContext, DefuddleParseResult } from "../shared/variables"
import { pickImage } from "./image"

export interface CaptureExtras {
    selection?: string
    highlights?: string[]
}

export function captureContext(
    doc: Document,
    url: string,
    extras: CaptureExtras = {},
): ClipContext {
    const parsed = new Defuddle(doc, { markdown: true }).parse() as DefuddleParseResult
    return buildContext(doc, url, parsed, extras)
}

export function buildContext(
    doc: Document,
    url: string,
    parsed: DefuddleParseResult,
    extras: CaptureExtras = {},
): ClipContext {
    const content = parsed.content ?? ""
    const author = Array.isArray(parsed.author) ? parsed.author.join(", ") : (parsed.author ?? "")
    let base: URL
    try {
        base = new URL(url)
    } catch {
        base = new URL("https://example.invalid/")
    }
    return {
        url,
        domain: base.hostname,
        date: new Date().toISOString(),
        title: parsed.title ?? "",
        author,
        description: parsed.description ?? "",
        content,
        words: parsed.wordCount ?? countWords(content),
        language: parsed.language ?? doc.documentElement.getAttribute("lang") ?? "",
        favicon: resolveFavicon(doc, base),
        image: pickImage(doc, parsed.image, url),
        selection: extras.selection ?? "",
        highlights: extras.highlights ?? [],
    }
}

function countWords(markdown: string): number {
    const text = markdown
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[#>*_~`|]/g, " ")
        .replace(/<[^>]+>/g, " ")
    const words = text.split(/\s+/).filter((word) => word.length > 0)
    return words.length
}

function resolveFavicon(doc: Document, base: URL): string {
    const links = doc.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]')
    for (const link of links) {
        const href = link.getAttribute("href")
        if (!href) continue
        try {
            return new URL(href, base).href
        } catch {
            continue
        }
    }
    return new URL("/favicon.ico", base).href
}
