import { el, icon } from "../lib/dom"

export function pageSection(title: string, children: Array<Node | string>): HTMLElement {
    return el("section", { className: "page-section" }, [el("h2", { text: title }), ...children])
}

export function fieldRow(label: string, control: HTMLElement, description?: string): HTMLElement {
    const text = el("div", { className: "field-text" }, [
        el("label", { className: "field-label", text: label }),
    ])
    if (description) text.append(el("div", { className: "field-description", text: description }))
    return el("div", { className: "field-row" }, [text, control])
}

export function toggleInput(
    checked: boolean,
    onChange: (value: boolean) => void,
): HTMLInputElement {
    const input = document.createElement("input")
    input.type = "checkbox"
    input.className = "toggle-input"
    input.checked = checked
    input.addEventListener("change", () => onChange(input.checked))
    return input
}

export function selectInput(
    options: Array<{ value: string; label: string }>,
    value: string,
    onChange: (value: string) => void,
): HTMLSelectElement {
    const select = document.createElement("select")
    select.className = "text-input"
    for (const option of options) {
        const element = document.createElement("option")
        element.value = option.value
        element.textContent = option.label
        select.append(element)
    }
    select.value = value
    select.addEventListener("change", () => onChange(select.value))
    return select
}

export function textInput(
    value: string,
    placeholder: string,
    onChange?: (value: string) => void,
): HTMLInputElement {
    const input = el("input", {
        className: "text-input",
        attributes: { type: "text", placeholder },
    })
    input.value = value
    if (onChange) input.addEventListener("input", () => onChange(input.value))
    return input
}

export function textArea(
    value: string,
    placeholder: string,
    onChange: (value: string) => void,
    rows = 4,
): HTMLTextAreaElement {
    const area = el("textarea", {
        className: "text-input",
        attributes: { rows: String(rows), placeholder, spellcheck: "false" },
    })
    area.value = value
    area.addEventListener("input", () => onChange(area.value))
    return area
}

export function actionButton(
    label: string,
    onClick: () => void,
    kind: "primary" | "ghost" | "danger" = "ghost",
): HTMLButtonElement {
    return el(
        "button",
        {
            className: `action-button is-${kind}`,
            attributes: { type: "button" },
            events: { click: onClick },
        },
        [document.createTextNode(label)],
    )
}

export function iconButton(name: string, title: string, onClick: () => void): HTMLButtonElement {
    return el(
        "button",
        {
            className: "icon-button",
            attributes: { type: "button", title },
            events: { click: onClick },
        },
        [icon(name)],
    )
}

export function listCard(children: Array<Node | string>): HTMLElement {
    return el("div", { className: "list-card" }, children)
}

export function listRow(children: Array<Node | string>): HTMLElement {
    return el("div", { className: "list-row" }, children)
}

export function emptyNote(text: string): HTMLElement {
    return el("div", { className: "empty-note", text })
}

export function openDialog(title: string, form: Array<Node | string>, onSave: () => void): void {
    const dialog = document.createElement("dialog")
    dialog.className = "popup-dialog"
    const save = actionButton(
        "Save",
        () => {
            onSave()
            dialog.close()
        },
        "primary",
    )
    const cancel = actionButton("Cancel", () => dialog.close())
    dialog.append(
        el("h3", { text: title }),
        ...form,
        el("div", { className: "dialog-actions" }, [cancel, save]),
    )
    document.body.append(dialog)
    dialog.addEventListener("close", () => dialog.remove())
    dialog.showModal()
}
