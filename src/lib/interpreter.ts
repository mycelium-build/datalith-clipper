import type { ClipperSettings } from "./settings-schema"

export interface InterpreterConfig {
    baseUrl: string
    apiKey: string
    modelId: string
    context: string
}

export type InterpreterResponse = { ok: true; content: string } | { ok: false; error: string }

export interface InterpreterAvailability {
    enabled: boolean
    configured: boolean
}

// Used by the panel for status
export function interpreterAvailability(settings: ClipperSettings): InterpreterAvailability {
    const interpreter = settings.interpreter
    if (!interpreter.enabled) return { enabled: false, configured: false }
    const model = interpreter.models.find(
        (candidate) => candidate.id === interpreter.selectedModelId,
    )
    if (!model) return { enabled: true, configured: false }
    const provider = interpreter.providers.find((candidate) => candidate.id === model.providerId)
    return { enabled: true, configured: provider !== undefined && provider.baseUrl !== "" }
}

export function resolveInterpreterConfig(
    settings: ClipperSettings,
    templateContext: string,
): InterpreterConfig | null {
    const interpreter = settings.interpreter
    if (!interpreter.enabled) return null
    const model = interpreter.models.find(
        (candidate) => candidate.id === interpreter.selectedModelId,
    )
    if (!model) return null
    const provider = interpreter.providers.find((candidate) => candidate.id === model.providerId)
    if (!provider || provider.baseUrl === "") return null
    return {
        baseUrl: provider.baseUrl.replace(/\/+$/, ""),
        apiKey: provider.apiKey,
        modelId: model.modelId,
        context: templateContext !== "" ? templateContext : interpreter.context,
    }
}

export type CompleteSender = (context: string, prompt: string) => Promise<InterpreterResponse>

async function defaultSend(context: string, prompt: string): Promise<InterpreterResponse> {
    const browser = (await import("webextension-polyfill")).default
    return browser.runtime.sendMessage({
        type: "interpreter-complete",
        context,
        prompt,
    })
}

export function createCompleter(
    resolveContext: () => Promise<string>,
    send: CompleteSender = defaultSend,
): (prompt: string) => Promise<string> {
    const cache = new Map<string, string>()
    return async (prompt) => {
        let context = ""
        try {
            context = await resolveContext()
        } catch {
            context = ""
        }
        const key = `${context}\u0000${prompt}`
        const cached = cache.get(key)
        if (cached !== undefined) return cached
        const result = await send(context, prompt)
        const content = result.ok ? result.content : prompt
        cache.set(key, content)
        return content
    }
}
