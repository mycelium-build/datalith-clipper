import browser from "webextension-polyfill"

import { el } from "../../lib/dom"
import type { InterpreterModel, InterpreterProvider } from "../../lib/settings-schema"
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
            fieldRow("Model use", buildModelSelect(ctx)),
        ]),
    )

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
    const rows = interpreter.providers.map((provider, index) =>
        listRow([
            el("div", { className: "list-text" }, [
                el("span", { className: "list-title", text: provider.baseUrl }),
                el("span", {
                    className: "list-subtitle",
                    text: provider.apiKey ? "API key set" : "No API key",
                }),
            ]),
            el("span", { className: "list-actions" }, [
                iconButton("chevron-up", "Move up", () => moveProvider(ctx, index, -1)),
                iconButton("chevron-down", "Move down", () => moveProvider(ctx, index, 1)),
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
    return el("div", { className: "section-stack" }, [
        listCard(rows.length > 0 ? rows : [emptyNote("No providers configured.")]),
        el("div", { className: "field-row" }, [add]),
    ])
}

function moveProvider(ctx: PageContext, index: number, direction: number): void {
    const providers = ctx.state.settings.interpreter.providers
    const target = index + direction
    if (target < 0 || target >= providers.length) return
    const [provider] = providers.splice(index, 1)
    if (provider) providers.splice(target, 0, provider)
    ctx.save()
    ctx.rerender()
}

function providerDialog(ctx: PageContext, providerId: string | null): void {
    const interpreter = ctx.state.settings.interpreter
    const existing = providerId ? interpreter.providers.find((p) => p.id === providerId) : undefined
    const baseUrl = textInput(existing?.baseUrl ?? "", "https://api.openai.com/v1")
    const apiKey = textInput(existing?.apiKey ?? "", "sk-…")
    openDialog("Provider", [fieldRow("Base URL", baseUrl), fieldRow("API key", apiKey)], () => {
        const apply = () => {
            if (existing) {
                existing.baseUrl = baseUrl.value.trim()
                existing.apiKey = apiKey.value.trim()
            } else {
                const provider: InterpreterProvider = {
                    id: uniqueId("provider"),
                    baseUrl: baseUrl.value.trim(),
                    apiKey: apiKey.value.trim(),
                }
                interpreter.providers.push(provider)
            }
            ctx.save()
            ctx.rerender()
        }
        void requestOriginPermission(baseUrl.value).then(apply)
    })
}

async function requestOriginPermission(baseUrl: string): Promise<void> {
    try {
        const origin = `${new URL(baseUrl.trim()).origin}/*`
        await browser.permissions.request({ origins: [origin] })
    } catch {
        // Invalid URL or permission denied
    }
}

function buildModelList(ctx: PageContext): HTMLElement {
    const interpreter = ctx.state.settings.interpreter
    const add = actionButton("Add model", () => modelDialog(ctx, null))
    const rows = interpreter.models.map((model) =>
        listRow([
            el("div", { className: "list-text" }, [
                el("span", { className: "list-title", text: model.name }),
                el("span", { className: "list-subtitle", text: model.modelId }),
            ]),
            el("span", { className: "list-actions" }, [
                iconButton("gear", "Edit", () => modelDialog(ctx, model.id)),
                iconButton("close", "Delete", () => {
                    interpreter.models = interpreter.models.filter((m) => m.id !== model.id)
                    if (interpreter.selectedModelId === model.id) interpreter.selectedModelId = ""
                    ctx.save()
                    ctx.rerender()
                }),
            ]),
        ]),
    )
    return el("div", { className: "section-stack" }, [
        listCard(rows.length > 0 ? rows : [emptyNote("No models configured.")]),
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
            label: provider.baseUrl,
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
