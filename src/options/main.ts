import { el, icon } from "../lib/dom"
import { loadSettings, saveSettings } from "../lib/settings"
import { resolveTheme } from "../lib/settings-schema"
import { renderGeneral } from "./pages/general"
import { renderInterpreter } from "./pages/interpreter"
import { renderReader } from "./pages/reader"
import { renderTemplateEditor } from "./pages/template-editor"
import { ensureStoredTemplates, renderTemplates } from "./pages/templates"
import type { OptionsState, PageContext } from "./state"

const NAV_ITEMS: Array<{ hash: string; label: string; icon: string }> = [
    { hash: "#general", label: "General", icon: "gear" },
    { hash: "#reader", label: "Reader", icon: "eye" },
    { hash: "#interpreter", label: "Interpreter", icon: "bolt" },
]

let state: OptionsState | null = null

const ctx: PageContext = {
    get state(): OptionsState {
        if (!state) throw new Error("Options not initialized")
        return state
    },
    async save() {
        await saveSettings(this.state.settings)
        renderSidebar()
    },
    rerender() {
        renderRoute()
    },
    applyTheme() {
        document.documentElement.dataset.datalithTheme = resolveTheme(this.state.settings).id
    },
    navigate(hash: string) {
        if (location.hash === hash) {
            renderRoute()
        } else {
            location.hash = hash
        }
    },
}

function renderSidebar(): void {
    const sidebar = document.querySelector<HTMLElement>(".sidebar")
    if (!sidebar || !state) return
    const templates = ensureStoredTemplates(ctx)
    const current = location.hash || "#general"
    const nav = el("nav", {}, [
        ...NAV_ITEMS.map((item) =>
            el(
                "a",
                {
                    className: `nav-item${current === item.hash ? " is-active" : ""}`,
                    text: item.label,
                    attributes: { href: item.hash },
                },
                [icon(item.icon), document.createTextNode(item.label)],
            ),
        ),
        el("div", { className: "nav-section", text: "Templates" }),
        ...templates.map((template) =>
            el(
                "a",
                {
                    className: `nav-item${current === `#template/${template.id}` ? " is-active" : ""}`,
                    attributes: { href: `#template/${template.id}` },
                },
                [icon("note"), document.createTextNode(template.name)],
            ),
        ),
        el(
            "a",
            {
                className: `nav-item${current === "#templates" ? " is-active" : ""}`,
                attributes: { href: "#templates" },
            },
            [icon("plus"), document.createTextNode("Manage")],
        ),
    ])
    const brand = el("div", { className: "brand" }, [
        el("span", { className: "brand-mark", text: "◆" }),
        el("h1", { text: "Settings" }),
    ])
    sidebar.replaceChildren(brand, nav)
}

function renderRoute(): void {
    if (!state) return
    const content = document.querySelector<HTMLElement>(".content")
    if (!content) return
    const hash = location.hash || "#general"
    let page: HTMLElement
    if (hash.startsWith("#template/")) {
        page = renderTemplateEditor(ctx, decodeURIComponent(hash.slice("#template/".length)))
    } else if (hash === "#reader") {
        page = renderReader(ctx)
    } else if (hash === "#interpreter") {
        page = renderInterpreter(ctx)
    } else if (hash === "#templates") {
        page = renderTemplates(ctx)
    } else {
        page = renderGeneral(ctx)
    }
    content.replaceChildren(page)
    renderSidebar()
    content.querySelector("h2")?.scrollIntoView()
}

async function init(): Promise<void> {
    state = { settings: await loadSettings() }
    ctx.applyTheme()
    const media = matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", () => {
        if (state?.settings.appearance.mode === "auto") ctx.applyTheme()
    })
    window.addEventListener("hashchange", renderRoute)
    renderRoute()
}

void init()
