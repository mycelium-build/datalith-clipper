import { el, icon } from "../lib/dom"
import { loadSettings, saveSettings } from "../lib/settings"
import { resolveTheme } from "../lib/settings-schema"
import { newTemplate } from "../lib/templates"
import { dragHandle, makeSortable } from "./dnd"
import { renderGeneral } from "./pages/general"
import { renderInterpreter } from "./pages/interpreter"
import { renderReader } from "./pages/reader"
import { renderTemplateEditor } from "./pages/template-editor"
import type { OptionsState, PageContext } from "./state"
import { ensureStoredTemplates } from "./state"

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

function brand(): HTMLElement {
    return el("div", { className: "brand" }, [
        icon("clipper", "brand-mark"),
        el("h1", { text: "Settings" }),
    ])
}

function navLink(
    item: { hash: string; label: string; icon: string },
    current: string,
): HTMLElement {
    return el(
        "a",
        {
            className: `nav-item${current === item.hash ? " is-active" : ""}`,
            attributes: { href: item.hash },
        },
        [icon(item.icon), document.createTextNode(item.label)],
    )
}

function templateNavLink(templateId: string, name: string, current: string): HTMLElement {
    const item = el(
        "a",
        {
            className: `nav-item nav-template${current === `#template/${templateId}` ? " is-active" : ""}`,
            attributes: { href: `#template/${templateId}` },
        },
        [
            dragHandle("Drag to reorder"),
            el("span", { className: "nav-label", text: name }),
            el("span", { className: "spacer" }),
            el("span", { className: "nav-item-actions" }, [
                el(
                    "button",
                    {
                        className: "icon-button",
                        attributes: { type: "button", title: "Delete template" },
                        events: {
                            click: (event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                const templates = ctx.state.settings.templates
                                if (templateId === "default") return
                                ctx.state.settings.templates = templates.filter(
                                    (candidate) => candidate.id !== templateId,
                                )
                                if (location.hash === `#template/${templateId}`) {
                                    ctx.navigate("#general")
                                }
                                void ctx.save()
                            },
                        },
                    },
                    [icon("close")],
                ),
            ]),
        ],
    )
    return item
}

function renderSidebar(): void {
    const sidebar = document.querySelector<HTMLElement>(".sidebar")
    if (!sidebar || !state) return
    const templates = ensureStoredTemplates(ctx)
    const current = location.hash || "#general"
    const templateList = el("div", { className: "nav-templates" })
    for (const template of templates) {
        templateList.append(templateNavLink(template.id, template.name, current))
    }
    templateList.append(
        el(
            "button",
            {
                className: "nav-item nav-add",
                attributes: { type: "button" },
                events: {
                    click: () => {
                        const list = ensureStoredTemplates(ctx)
                        const template = newTemplate()
                        list.push(template)
                        void ctx.save()
                        ctx.navigate(`#template/${template.id}`)
                    },
                },
            },
            [icon("plus"), document.createTextNode("Add template")],
        ),
    )
    makeSortable(templateList, (from, to) => {
        const list = ctx.state.settings.templates
        const [moved] = list.splice(from, 1)
        if (moved) list.splice(to, 0, moved)
        void ctx.save()
        if (location.hash.startsWith("#template/")) renderRoute()
    })
    const nav = el("nav", {}, [
        navLink({ hash: "#general", label: "General", icon: "gear" }, current),
        navLink({ hash: "#reader", label: "Reader", icon: "eye" }, current),
        navLink({ hash: "#interpreter", label: "Interpreter", icon: "bolt" }, current),
        el("div", { className: "nav-section", text: "Templates" }),
        templateList,
    ])
    sidebar.replaceChildren(brand(), nav)
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
