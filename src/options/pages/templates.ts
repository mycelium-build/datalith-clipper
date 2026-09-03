import { el } from "../../lib/dom"
import { DEFAULT_TEMPLATES, newTemplate, type Template } from "../../lib/templates"
import type { PageContext } from "../state"
import { actionButton, emptyNote, iconButton, listCard, listRow, pageSection } from "../ui"

export function ensureStoredTemplates(ctx: PageContext): Template[] {
    if (ctx.state.settings.templates.length === 0) {
        ctx.state.settings.templates = structuredClone(DEFAULT_TEMPLATES)
    }
    return ctx.state.settings.templates
}

export function renderTemplates(ctx: PageContext): HTMLElement {
    const templates = ensureStoredTemplates(ctx)
    const rows = templates.map((template, index) =>
        listRow([
            el("div", { className: "list-text" }, [
                el("a", {
                    className: "list-title list-link",
                    text: template.name,
                    attributes: { href: `#template/${template.id}` },
                }),
                el("span", { className: "list-subtitle", text: template.trigger || "No trigger" }),
            ]),
            el("span", { className: "list-actions" }, [
                iconButton("chevron-up", "Move up", () => moveTemplate(ctx, index, -1)),
                iconButton("chevron-down", "Move down", () => moveTemplate(ctx, index, 1)),
                iconButton("gear", "Edit", () => ctx.navigate(`#template/${template.id}`)),
                ...(template.id === "default"
                    ? []
                    : [
                          iconButton("close", "Delete", () => {
                              ctx.state.settings.templates = templates.filter(
                                  (candidate) => candidate.id !== template.id,
                              )
                              ctx.save()
                              ctx.rerender()
                          }),
                      ]),
            ]),
        ]),
    )
    const newButton = actionButton("New template", () => {
        const list = ensureStoredTemplates(ctx)
        const template = newTemplate()
        template.id = `template-${crypto.randomUUID?.() ?? Date.now().toString(36)}`
        list.push(template)
        ctx.save()
        ctx.navigate(`#template/${template.id}`)
    })
    return pageSection("Templates", [
        listCard(rows.length > 0 ? rows : [emptyNote("No templates.")]),
        el("div", { className: "field-row" }, [newButton]),
    ])
}

function moveTemplate(ctx: PageContext, index: number, direction: number): void {
    const templates = ctx.state.settings.templates
    const target = index + direction
    if (target < 0 || target >= templates.length) return
    const [template] = templates.splice(index, 1)
    if (template) templates.splice(target, 0, template)
    ctx.save()
    ctx.rerender()
}
