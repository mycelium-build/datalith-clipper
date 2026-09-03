const MARK_CLASS = "datalith-highlight"
const STYLE_ID = "datalith-highlight-style"
const HOST_IDS = new Set(["datalith-clipper-host", "datalith-clipper-reader"])

let active = false
let onHighlight: ((text: string) => void) | null = null
const highlights: string[] = []
const marks: HTMLElement[] = []

export function isHighlighterActive(): boolean {
    return active
}

export function getHighlights(): string[] {
    return [...highlights]
}

export function toggleHighlighter(callback?: (text: string) => void): boolean {
    if (active) {
        stop()
        return false
    }
    start(callback)
    return true
}

export function clearHighlights(): void {
    stop()
    for (const mark of marks) unwrapMark(mark)
    marks.length = 0
    highlights.length = 0
}

function start(callback?: (text: string) => void): void {
    if (active) return
    active = true
    onHighlight = callback ?? null
    injectStyle()
    document.documentElement.classList.add("datalith-highlighting")
    document.addEventListener("mouseup", onMouseUp)
}

function stop(): void {
    if (!active) return
    active = false
    onHighlight = null
    document.documentElement.classList.remove("datalith-highlighting")
    document.removeEventListener("mouseup", onMouseUp)
}

function onMouseUp(): void {
    if (!active) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
    const text = selection.toString().replace(/\s+/g, " ").trim()
    if (text === "") return
    if (inExtensionUi(selection.anchorNode)) return
    for (let index = 0; index < selection.rangeCount; index++) {
        wrapRange(selection.getRangeAt(index))
    }
    selection.removeAllRanges()
    highlights.push(text)
    onHighlight?.(text)
}

function inExtensionUi(node: Node | null): boolean {
    let current: Node | null = node
    while (current) {
        if (current.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            const host = (current as ShadowRoot).host
            if (host instanceof Element && HOST_IDS.has(host.id)) return true
            current = host
            continue
        }
        current = current.parentNode
    }
    return false
}

function injectStyle(): void {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = `
        mark.${MARK_CLASS} {
            background-color: rgba(255, 213, 0, 0.45) !important;
            color: inherit !important;
            padding: 1px 0;
            -webkit-box-decoration-break: clone;
            box-decoration-break: clone;
        }
        html.datalith-highlighting,
        html.datalith-highlighting * {
            cursor: crosshair !important;
        }
    `
    document.head.append(style)
}

function wrapRange(range: Range): void {
    const container = range.commonAncestorContainer
    const root = container.nodeType === Node.TEXT_NODE ? container.parentElement : container
    if (!root) return
    const nodes: Text[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text
        if (text.length > 0 && range.intersectsNode(text)) nodes.push(text)
    }
    for (const node of nodes) {
        const text = node.textContent ?? ""
        let startOffset = 0
        let endOffset = text.length
        if (node === range.startContainer) startOffset = range.startOffset
        if (node === range.endContainer) endOffset = range.endOffset
        if (startOffset >= endOffset) continue
        const slice = text.slice(startOffset, endOffset)
        if (slice.trim() === "") continue
        node.splitText(endOffset)
        const middle = node.splitText(startOffset)
        const mark = document.createElement("mark")
        mark.className = MARK_CLASS
        mark.textContent = middle.textContent
        middle.replaceWith(mark)
        marks.push(mark)
    }
}

function unwrapMark(mark: HTMLElement): void {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark)
    }
    mark.remove()
    parent.normalize()
}
