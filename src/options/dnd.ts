import { icon } from "../lib/dom"

export function dragHandle(title = "Drag to reorder"): HTMLSpanElement {
    const handle = icon("grip", "drag-handle")
    handle.setAttribute("title", title)
    return handle
}

export function makeSortable(
    container: HTMLElement,
    onReorder: (from: number, to: number) => void,
): void {
    if (container.dataset.sortableBound === "true") return
    container.dataset.sortableBound = "true"

    const rows = (): HTMLElement[] =>
        [...container.children].filter(
            (child): child is HTMLElement =>
                child instanceof HTMLElement && child.querySelector(".drag-handle") !== null,
        )

    container.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return
        const target = event.target
        if (!(target instanceof Element)) return
        const handle = target.closest<HTMLElement>(".drag-handle")
        if (!handle || !container.contains(handle)) return
        const list = rows()
        const row = list.find((candidate) => candidate.contains(handle))
        if (!row) return
        event.preventDefault()
        const fromIndex = list.indexOf(row)
        let toIndex = fromIndex
        row.classList.add("is-dragging")
        try {
            handle.setPointerCapture(event.pointerId)
        } catch {
            // Pointer may already be gone; dragging still works without capture.
        }
        const drag = new AbortController()
        handle.addEventListener(
            "pointermove",
            (moveEvent) => {
                const hovered = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
                if (!(hovered instanceof Element)) return
                const hoveredRow = list.find((candidate) => candidate.contains(hovered))
                if (hoveredRow) toIndex = list.indexOf(hoveredRow)
            },
            { signal: drag.signal },
        )
        const finish = (commit: boolean) => {
            drag.abort()
            row.classList.remove("is-dragging")
            if (commit && toIndex !== fromIndex) onReorder(fromIndex, toIndex)
        }
        handle.addEventListener("pointerup", () => finish(true), { signal: drag.signal })
        handle.addEventListener("pointercancel", () => finish(false), { signal: drag.signal })
    })
}
