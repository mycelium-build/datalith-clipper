export interface ClipContext {
    url: string
    domain: string
    date: string
    title: string
    author: string
    description: string
    content: string
    words: number
    language: string
    favicon: string
    image: string
    selection: string
    highlights: string[]
}

export interface DefuddleParseResult {
    title?: string
    content?: string
    author?: string | string[]
    description?: string
    image?: string
    wordCount?: number
    site?: string
    language?: string
    favicon?: string
}
