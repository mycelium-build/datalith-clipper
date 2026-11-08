import { icons } from "./icons"

export type ElementAttributes = {
    className?: string
    text?: string
    dataset?: Record<string, string>
    events?: Record<string, (event: Event) => void>
    attributes?: Record<string, string>
}

export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes: ElementAttributes = {},
    children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag)
    if (attributes.className !== undefined) element.className = attributes.className
    if (attributes.text !== undefined) element.textContent = attributes.text
    if (attributes.dataset) {
        for (const [key, value] of Object.entries(attributes.dataset)) {
            element.dataset[key] = value
        }
    }
    if (attributes.attributes) {
        for (const [key, value] of Object.entries(attributes.attributes)) {
            element.setAttribute(key, value)
        }
    }
    if (attributes.events) {
        for (const [type, handler] of Object.entries(attributes.events)) {
            element.addEventListener(type, handler)
        }
    }
    for (const child of children) {
        element.append(child)
    }
    return element
}

export function icon(name: string, className = "icon"): HTMLSpanElement {
    const span = document.createElement("span")
    span.className = className
    const source = icons[name]
    if (source === undefined) {
        console.warn(`Unknown icon: ${name}`)
    }
    span.innerHTML = source ?? ""
    return span
}
