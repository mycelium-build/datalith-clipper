import browser from "webextension-polyfill"

import { el } from "../../lib/dom"
import type { Template } from "../../lib/templates"
import type { VaultsResponse } from "../../shared/messages"
import { dragHandle, makeSortable } from "../dnd"
import type { PageContext } from "../state"
import { ensureStoredTemplates } from "../state"
import {
    actionButton,
    emptyNote,
    fieldRow,
    iconButton,
    pageSection,
    selectInput,
    textArea,
    textInput,
} from "../ui"

interface Snippet {
    label: string
    insert: string
}

const VARIABLES: Snippet[] = [
    { label: "title", insert: "{{title}}" },
    { label: "url", insert: "{{url}}" },
    { label: "domain", insert: "{{domain}}" },
    { label: "author", insert: "{{author}}" },
    { label: "description", insert: "{{description}}" },
    { label: "content", insert: "{{content}}" },
    { label: "words", insert: "{{words}}" },
    { label: "language", insert: "{{language}}" },
    { label: "date", insert: "{{date}}" },
    { label: "favicon", insert: "{{favicon}}" },
    { label: "image", insert: "{{image}}" },
    { label: "selection", insert: "{{selection}}" },
    { label: "highlights", insert: "{{highlights}}" },
    { label: "items[0]", insert: "{{items[0]}}" },
    { label: "selector:h1", insert: "{{selector:h1}}" },
    { label: "selector:img.hero?src", insert: "{{selector:img.hero?src}}" },
]

const FUNCTIONS: Snippet[] = [
    { label: 'calc:"+10"', insert: '|calc:"+10"' },
    { label: "length", insert: "|length" },
    { label: "round", insert: "|round" },
    { label: "round:n", insert: "|round:2" },
    { label: 'join:"sep"', insert: '|join:", "' },
    { label: "merge:var", insert: "|merge:name" },
    { label: "nth:n", insert: "|nth:3" },
    { label: "reverse", insert: "|reverse" },
    { label: "slice:n,m", insert: "|slice:1,3" },
    { label: 'split:"sep"', insert: '|split:","' },
    { label: "unique", insert: "|unique" },
    { label: 'date_modify:"expr"', insert: '|date_modify:"+1 day"' },
]

const STATEMENTS: Snippet[] = [
    { label: "if / endif", insert: "{% if variable %}\n\n{% endif %}" },
    {
        label: "if / elseif / else",
        insert: "{% if a == 1 %}\n\n{% elseif a == 2 %}\n\n{% else %}\n\n{% endif %}",
    },
    {
        label: "for / endfor",
        insert: "{% for item in items %}\n{{item}} {{loop.index}}\n{% endfor %}",
    },
    { label: "set", insert: "{% set name = author %}" },
    { label: "fallback ??", insert: "{{ author ?? 'Unknown' }}" },
    { label: "prompt", insert: '{"Summarize this page in one sentence"}' },
    { label: "logic", insert: "{% if (a < 10 || a > 100) && b == 10 %}\n\n{% endif %}" },
]

export function renderTemplateEditor(ctx: PageContext, templateId: string): HTMLElement {
    const template = ensureStoredTemplates(ctx).find((candidate) => candidate.id === templateId)
    if (!template) {
        ctx.navigate("#templates")
        return emptyNote("Template not found.")
    }
    return buildEditor(ctx, template)
}

function buildEditor(ctx: PageContext, template: Template): HTMLElement {
    const container = document.createElement("div")
    container.className = "template-editor"

    let lastEditable: HTMLInputElement | HTMLTextAreaElement | null = null
    container.addEventListener("focusin", (event) => {
        const target = event.target
        if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
            lastEditable = target
        }
    })
    const insert = (snippet: string) => {
        const target = lastEditable ?? contentArea
        const start = target.selectionStart ?? target.value.length
        const end = target.selectionEnd ?? start
        target.value = target.value.slice(0, start) + snippet + target.value.slice(end)
        target.dispatchEvent(new Event("input"))
        target.focus()
        target.setSelectionRange(start + snippet.length, start + snippet.length)
    }

    const back = actionButton("← Back", () => ctx.navigate("#general"))
    const save = actionButton(
        "Save",
        () => {
            void ctx.save()
        },
        "primary",
    )

    const nameInput = textInput(template.name, "Template name", (value) => (template.name = value))
    const triggerArea = textArea(
        template.trigger,
        "github.com/*\narxiv.org/abs/*",
        (value) => (template.trigger = value),
        3,
    )
    const noteNameInput = textInput(
        template.noteName,
        "{{title}}",
        (value) => (template.noteName = value),
    )
    const folderInput = textInput(
        template.noteFolder,
        "Clips",
        (value) => (template.noteFolder = value),
    )
    const vaultSelect = selectInput(
        [{ value: "Last used", label: "Last used" }],
        template.vault,
        (value) => (template.vault = value),
    )
    fillVaultOptions(vaultSelect)
    const contextArea = textArea(template.context, "", (value) => (template.context = value), 3)

    const contentArea = textArea(template.content, "", (value) => (template.content = value), 14)

    const propertyRows = document.createElement("div")
    propertyRows.className = "property-rows"
    const renderProperties = () => {
        propertyRows.replaceChildren()
        template.properties.forEach((property, index) => {
            const nameField = textInput(property.name, "name", (value) => (property.name = value))
            const valueField = textInput(
                property.value,
                "{{title}}",
                (value) => (property.value = value),
            )
            const row = el("div", { className: "property-edit-row sortable-row" }, [
                dragHandle("Drag to reorder"),
                nameField,
                valueField,
                iconButton("close", "Delete", () => {
                    template.properties.splice(index, 1)
                    renderProperties()
                }),
            ])
            propertyRows.append(row)
        })
        makeSortable(propertyRows, (from, to) => {
            const [moved] = template.properties.splice(from, 1)
            if (moved) template.properties.splice(to, 0, moved)
            renderProperties()
        })
    }
    renderProperties()
    const addProperty = actionButton("Add property", () => {
        template.properties.push({ name: "", value: "" })
        renderProperties()
    })

    const reference = document.createElement("aside")
    reference.className = "template-reference"
    reference.append(
        referenceGroup("Variables", VARIABLES, insert),
        referenceGroup("Functions", FUNCTIONS, insert),
        referenceGroup("Statements", STATEMENTS, insert),
    )

    container.append(
        el("div", { className: "editor-header" }, [back, save]),
        el("div", { className: "editor-grid" }, [
            el("div", { className: "editor-fields" }, [
                pageSection("Template", [
                    fieldRow("Name", nameInput),
                    fieldRow(
                        "Trigger",
                        triggerArea,
                        "One URL glob per line. Auto-selects this template when the page URL matches. Empty means manual selection.",
                    ),
                    fieldRow("Note name", noteNameInput),
                    fieldRow("Note folder", folderInput),
                    fieldRow("Vault", vaultSelect),
                ]),
                pageSection("Properties", [
                    propertyRows,
                    el("div", { className: "field-row" }, [addProperty]),
                    el("div", {
                        className: "field-description",
                        text: "Frontmatter properties for the saved note. Values accept variables.",
                    }),
                ]),
                pageSection("Content", [
                    contentArea,
                    el("div", {
                        className: "field-description",
                        text: "Markdown body of the note. Use variables, pipes and statements from the reference.",
                    }),
                ]),
                pageSection("Context", [
                    contextArea,
                    el("div", {
                        className: "field-description",
                        text: 'Overrides the global interpreter context for {"prompt"} expressions in this template.',
                    }),
                ]),
            ]),
            reference,
        ]),
    )
    return container
}

function referenceGroup(
    title: string,
    snippets: Snippet[],
    insert: (snippet: string) => void,
): HTMLElement {
    const children = snippets.map((snippet) =>
        el(
            "button",
            {
                className: "reference-item",
                attributes: { type: "button", title: `Insert ${snippet.label}` },
                events: { click: () => insert(snippet.insert) },
            },
            [document.createTextNode(snippet.label)],
        ),
    )
    return el("div", { className: "reference-group" }, [
        el("div", { className: "reference-title", text: title }),
        ...children,
    ])
}

function fillVaultOptions(select: HTMLSelectElement): void {
    void browser.runtime
        .sendMessage({ type: "get-vaults" })
        .then((response: unknown) => {
            const vaults = (response as VaultsResponse).ok
                ? (response as VaultsResponse & { vaults: Array<{ name: string }> }).vaults
                : []
            for (const vault of vaults) {
                const option = document.createElement("option")
                option.value = vault.name
                option.textContent = vault.name
                select.append(option)
            }
            if (!select.querySelector(`option[value="${CSS.escape(select.value)}"]`)) {
                select.value = "Last used"
            }
        })
        .catch(() => {})
}
