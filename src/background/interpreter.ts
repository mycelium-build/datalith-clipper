import type { InterpreterConfig, InterpreterResponse } from "../lib/interpreter"

const REQUEST_TIMEOUT_MS = 60_000

interface ChatCompletionResponse {
    choices?: Array<{ message?: { content?: unknown } }>
}

export async function completePrompt(
    config: InterpreterConfig,
    prompt: string,
    fetchImpl: typeof fetch = fetch.bind(globalThis),
): Promise<InterpreterResponse> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Datalith-Client": "clipper",
    }
    if (config.apiKey !== "") {
        headers.Authorization = `Bearer ${config.apiKey}`
    }
    const messages: Array<{ role: string; content: string }> = []
    if (config.context !== "") {
        messages.push({ role: "system", content: config.context })
    }
    messages.push({ role: "user", content: prompt })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers,
            signal: controller.signal,
            body: JSON.stringify({ model: config.modelId, messages }),
        })
        if (!response.ok) {
            return { ok: false, error: `${response.status} ${response.statusText}` }
        }
        const data = (await response.json()) as ChatCompletionResponse
        const content = data.choices?.[0]?.message?.content
        if (typeof content !== "string") {
            return { ok: false, error: "Malformed completion response" }
        }
        return { ok: true, content }
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Request failed" }
    } finally {
        clearTimeout(timer)
    }
}
