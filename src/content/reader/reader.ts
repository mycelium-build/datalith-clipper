import DOMPurify from "dompurify"
import { marked } from "marked"

import { el, icon } from "../../lib/dom"
import { captureContext } from "../../lib/extract"
import { loadSettings } from "../../lib/settings"
import { readerStyleVars, resolveTheme, type ClipperSettings } from "../../lib/settings-schema"

import readerCss from "../../styles/reader.css"
import themesCss from "../../styles/themes.css"

const HOST_ID = "datalith-clipper-reader"

class Reader {
    private host: HTMLElement
    private shadow: ShadowRoot
    private root: HTMLDivElement

    private constructor(host: HTMLElement, settings: ClipperSettings, title: string, html: string) {
        this.host = host
        this.shadow = host.shadowRoot as ShadowRoot
        const theme = resolveTheme(settings)
        const style = document.createElement("style")
        style.textContent = `${themesCss}\n${readerCss}`
        const root = el("div", { className: "reader-root", dataset: { datalithTheme: theme.id } })
        root.append(
            el("div", { className: "reader-header" }, [
                el("span", { className: "reader-title", text: title || "Reader" }),
                el(
                    "button",
                    {
                        className: "icon-button",
                        attributes: { type: "button", title: "Close reader" },
                        events: { click: () => Reader.close() },
                    },
                    [icon("close")],
                ),
            ]),
            el("div", { className: "reader-scroll" }, [
                el("div", {
                    className: "reader-article",
                    attributes: { innerHTML: DOMPurify.sanitize(html) },
                }),
            ]),
        )
        for (const [name, value] of Object.entries(readerStyleVars(settings))) {
            root.style.setProperty(name, value)
        }
        this.root = root
        this.shadow.replaceChildren(style, root)
        this.shadow.addEventListener("keydown", (event) => {
            if ((event as KeyboardEvent).key === "Escape") Reader.close()
        })
    }

    static async toggle(): Promise<void> {
        if (Reader.current) {
            Reader.close()
            return
        }
        const settings = await loadSettings()
        const url = location.href
        const context = captureContext(document, url)
        const html = marked.parse(context.content, { async: false })
        const host = ensureHost()
        host.dataset.readerOpen = "true"
        Reader.current = new Reader(host, settings, context.title, html)
    }

    static current: Reader | null = null

    static close(): void {
        if (!Reader.current) return
        Reader.current.host.dataset.readerOpen = "false"
        Reader.current.host.replaceChildren()
        Reader.current = null
    }
}

function ensureHost(): HTMLElement {
    let host = document.getElementById(HOST_ID)
    if (!host) {
        host = document.createElement("div")
        host.id = HOST_ID
        document.documentElement.appendChild(host)
        host.attachShadow({ mode: "open" })
    }
    return host
}

export function toggleReader(): void {
    Reader.toggle()
}
