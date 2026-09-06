import { el, icon } from "../../lib/dom"
import type { InterpreterModel, InterpreterProvider } from "../../lib/settings-schema"
import { dragHandle, makeSortable } from "../dnd"
import { requestOriginPermission } from "../permissions"
import { uniqueId, type PageContext } from "../state"
import {
    actionButton,
    emptyNote,
    fieldRow,
    iconButton,
    listCard,
    listRow,
    openDialog,
    pageSection,
    selectInput,
    textArea,
    textInput,
    toggleInput,
} from "../ui"

export function renderInterpreter(ctx: PageContext): HTMLElement {
    const container = document.createElement("div")
    const interpreter = ctx.state.settings.interpreter

    container.append(
        pageSection("Interpreter", [
            fieldRow(
                "Enable",
                toggleInput(interpreter.enabled, (value) => {
                    interpreter.enabled = value
                    ctx.save()
                }),
                'Evaluates {"prompt"} expressions in templates with the selected model.',
            ),
            fieldRow(
                "Execute when panel opens",
                toggleInput(interpreter.execOnOpen, (value) => {
                    interpreter.execOnOpen = value
                    ctx.save()
                }),
                "Runs prompts as soon as the panel opens instead of when saving.",
            ),
            fieldRow("Model use", buildModelSelect(ctx)),
        ]),
    )

    container.append(pageSection("Advice", [adviceNote()]))
    container.append(pageSection("Providers", [buildProviderList(ctx)]))
    container.append(pageSection("Models", [buildModelList(ctx)]))

    container.append(
        pageSection("Context", [
            fieldRow(
                "Context",
                textArea(
                    interpreter.context,
                    "Extra context sent with every prompt",
                    (value) => {
                        interpreter.context = value
                        ctx.save()
                    },
                    5,
                ),
                "Sent as the system message for interpreter prompts. Templates can override it.",
            ),
        ]),
    )
    return container
}

function adviceNote(): HTMLElement {
    return el("div", { className: "advice-note" }, [
        document.createTextNode(
            "For the best privacy and speed, run the interpreter on a small local model instead of a cloud API. " +
                "We recommend serving a compact model such as Liquid AI's LFM2.5 2.6B with LM Studio: start its local server, " +
                'then add a provider pointing at it ("http://localhost:1234/v1"). ' +
                "This way the page content you clip never leaves your machine.",
        ),
    ])
}

function buildModelSelect(ctx: PageContext): HTMLElement {
    const interpreter = ctx.state.settings.interpreter
    if (interpreter.models.length === 0) {
        return emptyNote("No models yet — add one below.")
    }
    return selectInput(
        interpreter.models.map((model) => ({ value: model.id, label: model.name })),
        interpreter.selectedModelId,
        (value) => {
            interpreter.selectedModelId = value
            ctx.save()
        },
    )
}

function buildProviderList(ctx: PageContext): HTMLElement {
    const interpreter = ctx.state.settings.interpreter
    const add = actionButton("Add provider", () => providerDialog(ctx, null))
    const rows = interpreter.providers.map((provider) =>
        listRow([
            dragHandle(),
            el("div", { className: "list-text" }, [
                el("span", { className: "list-title", text: provider.name || provider.baseUrl }),
                el("span", {
                    className: "list-subtitle",
                    text: provider.name
                        ? provider.baseUrl
                        : provider.apiKey
                          ? "API key set"
                          : "No API key",
                }),
            ]),
            el("span", { className: "list-actions" }, [
                iconButton("gear", "Edit", () => providerDialog(ctx, provider.id)),
                iconButton("close", "Delete", () => {
                    interpreter.providers = interpreter.providers.filter(
                        (p) => p.id !== provider.id,
                    )
                    interpreter.models = interpreter.models.filter(
                        (m) => m.providerId !== provider.id,
                    )
                    ctx.save()
                    ctx.rerender()
                }),
            ]),
        ]),
    )
    const card = listCard(rows.length > 0 ? rows : [emptyNote("No providers configured.")])
    makeSortable(card, (from, to) => {
        const list = interpreter.providers
        const [moved] = list.splice(from, 1)
        if (moved) list.splice(to, 0, moved)
        void ctx.save()
        ctx.rerender()
    })
    return el("div", { className: "section-stack" }, [
        card,
        el("div", { className: "field-row" }, [add]),
    ])
}

function providerDialog(ctx: PageContext, providerId: string | null): void {
    const interpreter = ctx.state.settings.interpreter
    const existing = providerId ? interpreter.providers.find((p) => p.id === providerId) : undefined
    const name = textInput(existing?.name ?? "", "LM Studio")
    const baseUrl = textInput(existing?.baseUrl ?? "", "http://localhost:1234/v1")
    const apiKey = textInput(existing?.apiKey ?? "", "sk-…")
    openDialog(
        "Provider",
        [
            fieldRow("Display name", name),
            fieldRow("Base URL", baseUrl),
            fieldRow("API key", apiKey),
        ],
        () => {
            const apply = () => {
                if (existing) {
                    existing.name = name.value.trim() || existing.name
                    existing.baseUrl = baseUrl.value.trim()
                    existing.apiKey = apiKey.value.trim()
                } else {
                    const provider: InterpreterProvider = {
                        id: uniqueId("provider"),
                        name: name.value.trim(),
                        baseUrl: baseUrl.value.trim(),
                        apiKey: apiKey.value.trim(),
                    }
                    interpreter.providers.push(provider)
                }
                ctx.save()
                ctx.rerender()
            }
            void requestOriginPermission(baseUrl.value).then(apply)
        },
    )
}

function buildModelList(ctx: PageContext): HTMLElement {
    const interpreter = ctx.state.settings.interpreter
    const add = actionButton("Add model", () => modelDialog(ctx, null))
    const rows = interpreter.models.map((model) => {
        const selected = interpreter.selectedModelId === model.id
        const row = listRow([
            dragHandle(),
            el("div", { className: "list-text" }, [
                el("span", { className: "list-title", text: model.name }),
                el("span", { className: "list-subtitle", text: model.modelId }),
            ]),
            el("span", { className: "list-actions" }, [
                el(
                    "button",
                    {
                        className: `icon-button${selected ? " is-selected-model" : ""}`,
                        attributes: {
                            type: "button",
                            title: selected ? "Model in use" : "Use this model",
                        },
                        events: {
                            click: () => {
                                interpreter.selectedModelId = model.id
                                void ctx.save()
                                ctx.rerender()
                            },
                        },
                    },
                    [icon("check")],
                ),
                iconButton("gear", "Edit", () => modelDialog(ctx, model.id)),
                iconButton("close", "Delete", () => {
                    interpreter.models = interpreter.models.filter((m) => m.id !== model.id)
                    if (interpreter.selectedModelId === model.id) interpreter.selectedModelId = ""
                    ctx.save()
                    ctx.rerender()
                }),
            ]),
        ])
        if (selected) row.classList.add("is-selected")
        return row
    })
    const card = listCard(rows.length > 0 ? rows : [emptyNote("No models configured.")])
    makeSortable(card, (from, to) => {
        const list = interpreter.models
        const [moved] = list.splice(from, 1)
        if (moved) list.splice(to, 0, moved)
        void ctx.save()
        ctx.rerender()
    })
    return el("div", { className: "section-stack" }, [
        card,
        el("div", { className: "field-row" }, [add]),
    ])
}
function modelDialog(ctx: PageContext, modelId: string | null): void {
    const interpreter = ctx.state.settings.interpreter
    if (interpreter.providers.length === 0) {
        openDialog("Model", [emptyNote("Add a provider first.")], () => {})
        return
    }
    const existing = modelId ? interpreter.models.find((m) => m.id === modelId) : undefined
    const providerSelect = selectInput(
        interpreter.providers.map((provider) => ({
            value: provider.id,
            label: provider.name || provider.baseUrl,
        })),
        existing?.providerId ?? interpreter.providers[0]?.id ?? "",
        () => {},
    )
    const name = textInput(existing?.name ?? "", "GPT-4o mini")
    const modelIdInput = textInput(existing?.modelId ?? "", "gpt-4o-mini")
    openDialog(
        "Model",
        [
            fieldRow("Provider", providerSelect),
            fieldRow("Display name", name),
            fieldRow("Model ID", modelIdInput),
        ],
        () => {
            if (existing) {
                existing.providerId = providerSelect.value
                existing.name = name.value.trim() || existing.name
                existing.modelId = modelIdInput.value.trim() || existing.modelId
            } else {
                const model: InterpreterModel = {
                    id: uniqueId("model"),
                    name: name.value.trim() || modelIdInput.value.trim() || "Model",
                    modelId: modelIdInput.value.trim(),
                    providerId: providerSelect.value,
                }
                interpreter.models.push(model)
                if (interpreter.selectedModelId === "") interpreter.selectedModelId = model.id
            }
            ctx.save()
            ctx.rerender()
        },
    )
}
