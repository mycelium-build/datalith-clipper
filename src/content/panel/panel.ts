import DOMPurify from "dompurify"
import { marked } from "marked"
import browser from "webextension-polyfill"

import { el, icon } from "../../lib/dom"
import { captureContext } from "../../lib/extract"
import { matchAnyGlob } from "../../lib/glob"
import { createCompleter, resolveInterpreterConfig } from "../../lib/interpreter"
import { renderWikilinkEmbeds } from "../../lib/markdown"
import { loadSettings, saveSettings } from "../../lib/settings"
import type { ClipperSettings } from "../../lib/settings-schema"
import { resolveTheme } from "../../lib/settings-schema"
import { renderTemplate, type RenderOptions } from "../../lib/template"
import {
    DEFAULT_TEMPLATE,
    LAST_USED_VAULT,
    resolveTemplates,
    type Template,
} from "../../lib/templates"
import type { SaveResponse, VaultsResponse } from "../../shared/messages"
import type { ClipContext } from "../../shared/variables"
import { clearHighlights, toggleHighlighter } from "../highlighter"
import { toggleReader } from "../reader/reader"

import panelCss from "../../styles/panel.css"
import themesCss from "../../styles/themes.css"

const HOST_ID = "datalith-clipper-host"

interface PropertyRow {
    name: string
    value: string
}

interface DraftState {
    template: Template
    context: ClipContext
    title: string
    folder: string
    properties: PropertyRow[]
    content: string
    vault: string
}

function contextEntries(context: ClipContext): Array<[string, string]> {
    return [
        ["title", context.title],
        ["author", context.author],
        ["description", context.description],
        ["content", context.content],
        ["words", String(context.words)],
        ["language", context.language],
        ["url", context.url],
        ["domain", context.domain],
        ["date", context.date],
        ["favicon", context.favicon],
        ["image", context.image],
        ["selection", context.selection],
        ["highlights", context.highlights.map((highlight) => `- ${highlight}`).join("\n")],
    ]
}

function pickTemplate(templates: Template[], url: string, lastTemplateId: string): Template {
    const triggered = templates.find((template) => matchAnyGlob(url, template.trigger))
    if (triggered) return triggered
    const remembered = templates.find((template) => template.id === lastTemplateId)
    return remembered ?? templates[0] ?? DEFAULT_TEMPLATE
}

export class Panel {
    private host: HTMLElement
    private shadow: ShadowRoot
    private root: HTMLDivElement
    private state: DraftState | null = null
    private settings: ClipperSettings | null = null
    private minimized = false
    private propertiesCollapsed = false
    private templates: Template[] = []
    private renderOptions: RenderOptions | null = null
    private contentDirty = false
    private listeners = new AbortController()

    private constructor(host: HTMLElement) {
        this.host = host
        this.shadow = host.shadowRoot as ShadowRoot
        this.root = this.buildDom()
    }

    static async toggle(
        selection: string,
        options: { enableHighlighter?: boolean } = {},
    ): Promise<void> {
        const host = ensureHost()
        if (host.dataset.panelOpen === "true") {
            Panel.current?.destroy()
            host.dataset.panelOpen = "false"
            return
        }
        host.dataset.panelOpen = "true"
        const settings = await loadSettings()
        const theme = resolveTheme(settings)
        host.dataset.datalithTheme = theme.id
        const panel = new Panel(host)
        Panel.current = panel
        await panel.load(selection, settings)
        if (options.enableHighlighter) panel.toggleHighlighter()
    }

    static current: Panel | null = null

    private async load(selection: string, settings: ClipperSettings): Promise<void> {
        this.settings = settings
        this.root.classList.add("is-loading")
        const url = location.href
        const context = captureContext(document, url, { selection, highlights: [] })
        this.templates = resolveTemplates(settings.templates)
        const template = pickTemplate(this.templates, url, settings.lastUsed.templateId)
        const variables: Record<string, unknown> = { ...context }
        const renderOptions: RenderOptions = { variables }
        this.renderOptions = renderOptions
        this.applyInterpreter(renderOptions, template)
        const draft = this.draftOptions()
        if (!draft) return
        const state: DraftState = {
            template,
            context,
            title: await renderTemplate(template.noteName, draft),
            folder: await renderTemplate(template.noteFolder, draft),
            content: await renderTemplate(template.content, draft),
            properties: [],
            vault: "",
        }
        state.properties = await Promise.all(
            template.properties.map(async (property) => ({
                name: property.name,
                value: await renderTemplate(property.value, draft),
            })),
        )
        state.vault = template.vault === LAST_USED_VAULT ? settings.lastUsed.vault : template.vault
        this.state = state
        this.populate()
        this.root.classList.remove("is-loading")
        this.refreshVaults(settings)
    }

    private applyInterpreter(options: RenderOptions, template: Template): void {
        const settings = this.settings
        if (!settings) return
        const interpreterConfig = resolveInterpreterConfig(settings, template.context)
        if (settings.interpreter.enabled && !interpreterConfig) {
            this.setStatus(
                "Interpreter is enabled but no model is configured, prompts render as plain text",
                "muted",
            )
        }
        options.interpreter = interpreterConfig
            ? createCompleter(interpreterConfig, undefined, async () =>
                  renderTemplate(interpreterConfig.context, { variables: options.variables }),
              )
            : undefined
    }

    /** Draft renders keep `{{highlights}}` (and `{"prompt"}` unless exec-on-open). */
    private draftOptions(): RenderOptions | null {
        const options = this.renderOptions
        if (!options) return null
        const execOnOpen = this.settings?.interpreter.execOnOpen === true
        return {
            variables: options.variables,
            deferred: ["highlights"],
            keepPrompts: !execOnOpen,
            interpreter: execOnOpen ? options.interpreter : undefined,
        }
    }

    /** Preview resolves highlights. */
    private previewOptions(): RenderOptions | null {
        const options = this.renderOptions
        if (!options) return null
        return { variables: options.variables, keepPrompts: true }
    }

    /** Save resolves everything: deferred variables and prompts. */
    private saveOptions(): RenderOptions | null {
        const options = this.renderOptions
        if (!options) return null
        return { variables: options.variables, interpreter: options.interpreter }
    }

    private async switchTemplate(template: Template): Promise<void> {
        const state = this.state
        const options = this.draftOptions()
        if (!state || !options) return
        state.template = template
        options.variables.highlights = state.context.highlights
        this.applyInterpreter(this.renderOptions as RenderOptions, template)
        state.title = await renderTemplate(template.noteName, options)
        state.folder = await renderTemplate(template.noteFolder, options)
        state.content = await renderTemplate(template.content, options)
        state.properties = await Promise.all(
            template.properties.map(async (property) => ({
                name: property.name,
                value: await renderTemplate(property.value, options),
            })),
        )
        this.contentDirty = false
        this.populate()
    }

    private buildDom(): HTMLDivElement {
        const style = document.createElement("style")
        style.textContent = `${themesCss}\n${panelCss}\n${fontFaceCss()}`
        this.shadow.replaceChildren(style)
        const root = el("div", {
            className: "panel-root",
            dataset: {
                datalithTheme: this.host.dataset.datalithTheme ?? "datalith-light",
            },
        })
        this.shadow.append(root)
        this.root = root
        this.buildBody()
        this.buildPill()
        this.shadow.addEventListener(
            "keydown",
            (event) => {
                if ((event as KeyboardEvent).key !== "Escape") return
                if (this.variablesModal.classList.contains("is-open")) {
                    this.toggleVariables(false)
                    return
                }
                if (this.minimized) {
                    this.setMinimized(false)
                    return
                }
                this.destroy()
            },
            { signal: this.listeners.signal },
        )
        return root
    }

    private buildBody(): void {
        const body = el("div", { className: "panel-body" })
        const loading = el("div", { className: "loading", text: "Capturing page…" })
        this.root.append(body, loading)
        this.buildToolbar(body)
        this.buildTitle(body)
        this.buildProperties(body)
        this.buildContentArea(body)
        this.buildFooter(body)
        this.buildStatus(body)
        this.buildVariablesModal(this.root)
    }

    private buildToolbar(body: HTMLDivElement): void {
        const select = el("select", {
            className: "template-select",
            attributes: { title: "Template" },
            events: {
                change: () => {
                    const template = this.templates.find(
                        (candidate) => candidate.id === select.value,
                    )
                    if (template) void this.switchTemplate(template)
                },
            },
        })
        this.templateSelect = select
        const actions: Array<[string, string, string, () => void]> = [
            ["variables", "columns", "Variables", () => this.toggleVariables(true)],
            ["highlighter", "pen", "Highlighter", () => this.toggleHighlighter()],
            ["reader", "eye", "Reader", () => toggleReader()],
            [
                "settings",
                "gear",
                "Settings",
                () => browser.runtime.sendMessage({ type: "open-settings" }),
            ],
            ["minimize", "chevron-down", "Minimize", () => this.setMinimized(true)],
            ["close", "close", "Close", () => this.destroy()],
        ]
        const toolbar = el("div", { className: "toolbar" }, [
            select,
            el("span", { className: "spacer" }),
            ...actions.map(([action, iconName, title, onClick]) =>
                el(
                    "button",
                    {
                        className: "icon-button",
                        dataset: { action },
                        attributes: { title, type: "button" },
                        events: { click: onClick },
                    },
                    [icon(iconName)],
                ),
            ),
        ])
        this.highlighterButton = toolbar.querySelector<HTMLButtonElement>(
            'button[data-action="highlighter"]',
        ) as HTMLButtonElement
        body.append(toolbar)
    }

    toggleHighlighter(): void {
        const on = toggleHighlighter((text) => this.appendHighlight(text))
        this.highlighterButton.classList.toggle("is-active", on)
        this.setStatus(on ? "Highlighter on — paint text on the page" : "", on ? "muted" : "")
    }

    private appendHighlight(text: string): void {
        const state = this.state
        if (!state) return
        state.context.highlights.push(text)
        const options = this.renderOptions
        if (options) options.variables.highlights = state.context.highlights
        if (this.contentDirty) {
            // The user owns the content, so quote the highlight at the end.
            const quoted = text.split("\n").join("\n> ")
            const base = state.content.trimEnd()
            state.content = base === "" ? `> ${quoted}` : `${base}\n\n> ${quoted}`
            this.contentInput.value = state.content
        }
        // Otherwise the template owns the content and its {{highlights}} stays.
        this.renderVariablesTable()
        this.setStatus(`Highlight added (${state.context.highlights.length})`, "muted")
    }

    private buildTitle(body: HTMLDivElement): void {
        const title = el("input", {
            className: "title-input",
            attributes: { type: "text", placeholder: "Note name", "aria-label": "Note name" },
            events: { input: () => this.updateDraft({ title: this.titleInput.value }) },
        })
        this.titleInput = title
        body.append(title)
    }

    private titleInput!: HTMLInputElement
    private templateSelect!: HTMLSelectElement
    private highlighterButton!: HTMLButtonElement
    private folderInput!: HTMLInputElement
    private contentInput!: HTMLTextAreaElement
    private previewPane!: HTMLDivElement
    private vaultSelect!: HTMLSelectElement
    private saveButton!: HTMLButtonElement
    private statusLine!: HTMLDivElement
    private propertiesSection!: HTMLDivElement
    private propertyRows!: HTMLDivElement
    private variablesModal!: HTMLDivElement
    private variablesTableBody!: HTMLTableSectionElement

    private buildProperties(body: HTMLDivElement): void {
        const rows = el("div", { className: "property-rows" })
        this.propertyRows = rows
        const toggle = el(
            "button",
            {
                className: "properties-toggle",
                attributes: { type: "button", title: "Properties" },
                events: { click: () => this.toggleProperties() },
            },
            [
                document.createTextNode("Properties"),
                el("span", { className: "chevron" }, [icon("chevron-down")]),
            ],
        )
        const add = el(
            "button",
            {
                className: "add-property",
                attributes: { type: "button" },
                events: { click: () => this.addProperty() },
            },
            [icon("plus"), document.createTextNode("Add property")],
        )
        this.propertiesSection = el("div", { className: "properties" }, [toggle, rows, add])
        this.propertiesSection.classList.toggle("is-collapsed", this.propertiesCollapsed)
        body.append(this.propertiesSection)
    }

    private buildContentArea(body: HTMLDivElement): void {
        const editTab = el(
            "button",
            {
                className: "content-tab is-active",
                attributes: { type: "button" },
                events: { click: () => this.showPreview(false) },
            },
            [document.createTextNode("Edit")],
        )
        const previewTab = el(
            "button",
            {
                className: "content-tab",
                attributes: { type: "button" },
                events: { click: () => this.showPreview(true) },
            },
            [document.createTextNode("Preview")],
        )
        this.contentInput = el("textarea", {
            className: "content-input",
            attributes: { "aria-label": "Note content", spellcheck: "false" },
            events: {
                input: () => {
                    this.contentDirty = true
                    this.updateDraft({ content: this.contentInput.value })
                },
            },
        })
        this.previewPane = el("div", { className: "content-preview", attributes: { hidden: "" } })
        body.append(
            el("div", { className: "content-area" }, [
                el("div", { className: "content-header" }, [editTab, previewTab]),
                this.contentInput,
                this.previewPane,
            ]),
        )
        this.editTab = editTab
        this.previewTab = previewTab
    }

    private editTab!: HTMLButtonElement
    private previewTab!: HTMLButtonElement

    private buildFooter(body: HTMLDivElement): void {
        this.vaultSelect = el("select", {
            className: "vault-select",
            attributes: { "aria-label": "Vault" },
            events: { change: () => this.updateDraft({ vault: this.vaultSelect.value }) },
        })
        this.vaultSelect.append(
            el("option", { text: "Loading vaults…", attributes: { value: "" } }),
        )
        const refresh = el(
            "button",
            {
                className: "icon-button",
                attributes: { type: "button", title: "Refresh vaults" },
                events: { click: () => this.settings && this.refreshVaults(this.settings) },
            },
            [icon("refresh")],
        )
        this.folderInput = el("input", {
            className: "folder-input",
            attributes: { type: "text", placeholder: "Folder", "aria-label": "Folder" },
            events: { input: () => this.updateDraft({ folder: this.folderInput.value }) },
        })
        this.saveButton = el(
            "button",
            {
                className: "save-button",
                attributes: { type: "button" },
                events: { click: () => this.save() },
            },
            [document.createTextNode("Save")],
        )
        body.append(
            el("div", { className: "footer" }, [
                el("div", { className: "footer-row" }, [this.vaultSelect, refresh]),
                el("div", { className: "footer-row" }, [this.folderInput]),
                this.saveButton,
            ]),
        )
    }

    private buildStatus(body: HTMLDivElement): void {
        this.statusLine = el("div", { className: "status-line" })
        body.append(this.statusLine)
    }

    private buildVariablesModal(root: HTMLDivElement): void {
        const header = el("div", { className: "variables-header" }, [
            document.createTextNode("Variables"),
            el(
                "button",
                {
                    className: "icon-button",
                    attributes: { type: "button", title: "Close" },
                    events: { click: () => this.toggleVariables(false) },
                },
                [icon("close")],
            ),
        ])
        const table = document.createElement("table")
        table.className = "variables-table"
        this.variablesTableBody = document.createElement("tbody")
        table.append(this.variablesTableBody)
        this.variablesModal = el("div", { className: "variables-modal" }, [
            el("div", { className: "variables-panel" }, [header, table]),
        ])
        this.variablesModal.addEventListener("click", (event) => {
            if (event.target === this.variablesModal) this.toggleVariables(false)
        })
        root.append(this.variablesModal)
    }

    private buildPill(): void {
        const pill = el("div", { className: "pill" }, [
            el(
                "button",
                {
                    className: "icon-button",
                    attributes: { type: "button", title: "Maximize" },
                    events: { click: () => this.setMinimized(false) },
                },
                [icon("chevron-up")],
            ),
            el(
                "button",
                {
                    className: "icon-button",
                    attributes: { type: "button", title: "Close" },
                    events: { click: () => this.destroy() },
                },
                [icon("close")],
            ),
        ])
        this.root.append(pill)
    }

    private populate(): void {
        const state = this.state
        if (!state) return
        this.templateSelect.replaceChildren(
            ...this.templates.map((template) =>
                el("option", { text: template.name, attributes: { value: template.id } }),
            ),
        )
        this.templateSelect.value = state.template.id
        this.titleInput.value = state.title
        this.folderInput.value = state.folder
        this.contentInput.value = state.content
        this.renderPropertyRows()
        this.renderVariablesTable()
    }

    private renderPropertyRows(): void {
        this.propertyRows.replaceChildren()
        const state = this.state
        if (!state) return
        for (const [index, property] of state.properties.entries()) {
            const nameInput = el("input", {
                className: "property-name",
                attributes: { type: "text", placeholder: "name", "aria-label": "Property name" },
                events: {
                    input: () => this.updateProperty(index, { name: nameInput.value }),
                },
            })
            nameInput.value = property.name
            const valueInput = el("input", {
                className: "property-value",
                attributes: { type: "text", placeholder: "value", "aria-label": "Property value" },
                events: {
                    input: () => this.updateProperty(index, { value: valueInput.value }),
                },
            })
            valueInput.value = property.value
            this.propertyRows.append(
                el("div", { className: "property-row" }, [
                    nameInput,
                    valueInput,
                    el(
                        "button",
                        {
                            className: "property-delete icon-button",
                            attributes: { type: "button", title: "Delete property" },
                            events: { click: () => this.deleteProperty(index) },
                        },
                        [icon("close")],
                    ),
                ]),
            )
        }
    }

    private renderVariablesTable(): void {
        this.variablesTableBody.replaceChildren()
        const state = this.state
        if (!state) return
        for (const [name, value] of contextEntries(state.context)) {
            this.variablesTableBody.append(
                el("tr", {}, [
                    el("td", { text: name }),
                    el("td", {}, [el("div", { className: "variables-value", text: value })]),
                ]),
            )
        }
    }

    private updateDraft(patch: Partial<DraftState>): void {
        if (!this.state) return
        this.state = { ...this.state, ...patch }
    }

    private updateProperty(index: number, patch: Partial<PropertyRow>): void {
        const state = this.state
        if (!state) return
        const property = state.properties[index]
        if (!property) return
        state.properties[index] = { ...property, ...patch }
    }

    private addProperty(): void {
        const state = this.state
        if (!state) return
        state.properties.push({ name: "", value: "" })
        this.renderPropertyRows()
        const inputs = this.propertyRows.querySelectorAll("input.property-name")
        ;(inputs[inputs.length - 1] as HTMLElement | null)?.focus()
    }

    private deleteProperty(index: number): void {
        const state = this.state
        if (!state) return
        state.properties.splice(index, 1)
        this.renderPropertyRows()
    }

    private toggleProperties(): void {
        this.propertiesCollapsed = !this.propertiesCollapsed
        this.propertiesSection.classList.toggle("is-collapsed", this.propertiesCollapsed)
    }

    private showPreview(preview: boolean): void {
        this.editTab.classList.toggle("is-active", !preview)
        this.previewTab.classList.toggle("is-active", preview)
        this.previewPane.hidden = !preview
        this.contentInput.hidden = preview
        if (preview) void this.renderPreview()
    }

    private async renderPreview(): Promise<void> {
        const options = this.previewOptions()
        if (!options) return
        const resolved = await renderTemplate(this.contentInput.value, options)
        const html = marked.parse(renderWikilinkEmbeds(resolved), { async: false })
        this.previewPane.innerHTML = DOMPurify.sanitize(html)
    }

    private toggleVariables(open: boolean): void {
        this.variablesModal.classList.toggle("is-open", open)
    }

    private setMinimized(minimized: boolean): void {
        this.minimized = minimized
        this.root.classList.toggle("is-minimized", minimized)
    }

    private setStatus(text: string, kind: "" | "error" | "success" | "muted" = ""): void {
        this.statusLine.textContent = text
        const kindClass =
            kind === "error"
                ? " is-error"
                : kind === "success"
                  ? " is-success"
                  : kind === "muted"
                    ? " is-muted"
                    : ""
        this.statusLine.className = `status-line${kindClass}`
    }

    private async refreshVaults(settings: ClipperSettings): Promise<void> {
        const response = (await browser.runtime.sendMessage({
            type: "get-vaults",
        })) as VaultsResponse
        const previous = this.state?.vault ?? settings.lastUsed.vault
        this.vaultSelect.replaceChildren()
        if (!response.ok) {
            this.vaultSelect.append(
                el("option", {
                    text: `Unavailable — ${response.error}`,
                    attributes: { value: "" },
                }),
            )
            this.vaultSelect.disabled = true
            this.saveButton.disabled = true
            return
        }
        this.vaultSelect.disabled = false
        this.saveButton.disabled = false
        if (response.vaults.length === 0) {
            this.vaultSelect.append(
                el("option", { text: "No vaults found", attributes: { value: "" } }),
            )
            return
        }
        for (const vault of response.vaults) {
            this.vaultSelect.append(
                el("option", { text: vault.name, attributes: { value: vault.name } }),
            )
        }
        const selected = response.vaults.some((vault) => vault.name === previous)
            ? previous
            : (response.vaults[0]?.name ?? "")
        this.vaultSelect.value = selected
        this.updateDraft({ vault: selected })
    }

    private async save(): Promise<void> {
        const state = this.state
        if (!state) return
        if (state.vault === "") {
            this.setStatus("Select a vault first", "error")
            return
        }
        this.saveButton.disabled = true
        this.setStatus("Saving…")
        const options = this.saveOptions()
        if (!options) return
        const properties = await Promise.all(
            state.properties
                .filter((property) => property.name.trim() !== "")
                .map(async (property) => ({
                    name: property.name.trim(),
                    value: await renderTemplate(property.value, options),
                })),
        )
        const note = {
            vault: state.vault,
            name: await renderTemplate(state.title, options),
            folder: await renderTemplate(state.folder, options),
            properties: Object.fromEntries(properties.map((p) => [p.name, p.value])),
            content: await renderTemplate(state.content, options),
        }
        const response = (await browser.runtime.sendMessage({
            type: "save-clip",
            note,
        })) as SaveResponse
        this.saveButton.disabled = false
        if (!response.ok) {
            if (response.launched) {
                this.setStatus(
                    "Datalith was not running — we launched it and retried, but the note was not saved. Try again once the app is up.",
                    "error",
                )
            } else {
                this.setStatus(`Save failed — ${response.error}`, "error")
            }
            return
        }
        this.setStatus("Saved to Datalith", "success")
        if (this.settings) {
            this.settings.lastUsed = {
                vault: state.vault,
                folder: state.folder,
                templateId: state.template.id,
            }
            await saveSettings(this.settings)
        }
    }

    destroy(): void {
        clearHighlights()
        this.listeners.abort()
        this.host.dataset.panelOpen = "false"
        this.shadow.replaceChildren()
        Panel.current = null
    }
}

function fontFaceCss(): string {
    const regular = browser.runtime.getURL("fonts/PixeloidSans.ttf")
    const bold = browser.runtime.getURL("fonts/PixeloidSans-Bold.ttf")
    return (
        `@font-face { font-display: swap; font-family: "Pixeloid Sans"; font-weight: 400; src: url("${regular}") format("truetype"); }\n` +
        `@font-face { font-display: swap; font-family: "Pixeloid Sans"; font-weight: 700; src: url("${bold}") format("truetype"); }\n`
    )
}

function ensureHost(): HTMLElement {
    let host = document.getElementById(HOST_ID)
    if (!host) {
        host = document.createElement("div")
        host.id = HOST_ID
        host.dataset.panelOpen = "false"
        document.documentElement.appendChild(host)
        host.attachShadow({ mode: "open" })
    }
    return host
}
