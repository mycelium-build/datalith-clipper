import type { ClipperSettings } from "./settings-schema"

export interface InterpreterConfig {
    baseUrl: string
    apiKey: string
    modelId: string
    context: string
}

export type InterpreterResponse = { ok: true; content: string } | { ok: false; error: string }

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

export type CompleteSender = (
    config: InterpreterConfig,
    prompt: string,
) => Promise<InterpreterResponse>

async function defaultSend(
    config: InterpreterConfig,
    prompt: string,
): Promise<InterpreterResponse> {
    const browser = (await import("webextension-polyfill")).default
    return (await browser.runtime.sendMessage({
        type: "interpreter-complete",
        config,
        prompt,
    })) as InterpreterResponse
}

export function createCompleter(
    config: InterpreterConfig,
    send: CompleteSender = defaultSend,
    resolveContext?: () => Promise<string>,
): (prompt: string) => Promise<string> {
    const cache = new Map<string, string>()
    return async (prompt) => {
        let context = config.context
        if (resolveContext) {
            try {
                context = await resolveContext()
            } catch {
                context = config.context
            }
        }
        const key = `${context}\u0000${prompt}`
        const cached = cache.get(key)
        if (cached !== undefined) return cached
        const result = await send({ ...config, context }, prompt)
        const content = result.ok ? result.content : prompt
        cache.set(key, content)
        return content
    }
}
