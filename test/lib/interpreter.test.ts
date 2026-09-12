import { describe, expect, it, vi } from "vitest"

import { completePrompt } from "../../src/background/interpreter"
import {
    createCompleter,
    resolveInterpreterConfig,
    type InterpreterConfig,
    type InterpreterResponse,
} from "../../src/lib/interpreter"
import { mergeDefaults } from "../../src/lib/settings-schema"

const CONFIG: InterpreterConfig = {
    baseUrl: "https://api.example.com/v1",
    apiKey: "sk-1",
    modelId: "test-model",
    context: "Be brief",
}

function settingsWithInterpreter(enabled: boolean) {
    return mergeDefaults({
        interpreter: {
            enabled,
            execOnOpen: false,
            selectedModelId: "m1",
            providers: [
                { id: "p1", name: "Test", baseUrl: "https://api.example.com/v1", apiKey: "sk-1" },
            ],
            models: [{ id: "m1", name: "Test", modelId: "test-model", providerId: "p1" }],
            context: "global context",
        },
    })
}

describe("resolveInterpreterConfig", () => {
    it("returns null when disabled", () => {
        expect(resolveInterpreterConfig(settingsWithInterpreter(false), "")).toBeNull()
    })

    it("resolves model and provider when enabled", () => {
        expect(resolveInterpreterConfig(settingsWithInterpreter(true), "")).toEqual({
            baseUrl: "https://api.example.com/v1",
            apiKey: "sk-1",
            modelId: "test-model",
            context: "global context",
        })
    })

    it("template context overrides the global context", () => {
        expect(
            resolveInterpreterConfig(settingsWithInterpreter(true), "template context")?.context,
        ).toBe("template context")
    })

    it("returns null without a selected model or provider", () => {
        const noModel = settingsWithInterpreter(true)
        noModel.interpreter.selectedModelId = ""
        expect(resolveInterpreterConfig(noModel, "")).toBeNull()
        const noProvider = settingsWithInterpreter(true)
        noProvider.interpreter.providers = []
        expect(resolveInterpreterConfig(noProvider, "")).toBeNull()
    })
})

describe("completePrompt", () => {
    function fetchMock(body: unknown, ok = true, status = 200) {
        return vi.fn(
            async () =>
                new Response(JSON.stringify(body), {
                    status: ok ? 200 : status,
                    statusText: "Error",
                }),
        ) as unknown as typeof fetch & ReturnType<typeof vi.fn>
    }

    it("posts model, system context and prompt to chat/completions", async () => {
        const fetchImpl = fetchMock({ choices: [{ message: { content: "Hello!" } }] })
        const result = await completePrompt(CONFIG, "Sum this", fetchImpl)
        expect(result).toEqual({ ok: true, content: "Hello!" })
        const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            RequestInit,
        ]
        expect(url).toBe("https://api.example.com/v1/chat/completions")
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-1")
        expect(JSON.parse(init.body as string)).toEqual({
            model: "test-model",
            messages: [
                { role: "system", content: "Be brief" },
                { role: "user", content: "Sum this" },
            ],
        })
    })

    it("omits the system message and auth header when unset", async () => {
        const fetchImpl = fetchMock({ choices: [{ message: { content: "x" } }] })
        await completePrompt({ ...CONFIG, apiKey: "", context: "" }, "p", fetchImpl)
        const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            RequestInit,
        ]
        expect(JSON.parse(init.body as string).messages).toEqual([{ role: "user", content: "p" }])
        expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
    })

    it("returns the prompt unchanged on HTTP errors", async () => {
        const fetchImpl = fetchMock({ error: "nope" }, false, 401)
        const result = await completePrompt(CONFIG, "Sum this", fetchImpl)
        expect(result.ok).toBe(false)
        expect(result.ok ? "" : result.error).toContain("401")
    })

    it("returns the prompt unchanged on network failure", async () => {
        const fetchImpl = (() =>
            Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch
        const result = await completePrompt(CONFIG, "Sum this", fetchImpl)
        expect(result.ok).toBe(false)
    })

    it("rejects malformed responses", async () => {
        const fetchImpl = fetchMock({ choices: [] })
        const result = await completePrompt(CONFIG, "Sum this", fetchImpl)
        expect(result).toEqual({ ok: false, error: "Malformed completion response" })
    })
})

describe("createCompleter", () => {
    const CONTEXT = async () => "ctx"

    function sendMock(
        response: InterpreterResponse | ((context: string, prompt: string) => InterpreterResponse),
    ) {
        return vi.fn(async (context: string, prompt: string): Promise<InterpreterResponse> =>
            typeof response === "function" ? response(context, prompt) : response,
        )
    }

    it("caches identical prompts per instance", async () => {
        const send = sendMock((_, prompt) => ({ ok: true, content: prompt.toUpperCase() }))
        const complete = createCompleter(CONTEXT, send)
        expect(await complete("same")).toBe("SAME")
        expect(await complete("same")).toBe("SAME")
        expect(await complete("other")).toBe("OTHER")
        expect(send).toHaveBeenCalledTimes(2)
    })

    it("sends only the context and the prompt — never provider config", async () => {
        const send = sendMock({ ok: true, content: "Hi" })
        const complete = createCompleter(CONTEXT, send)
        await complete("prompt")
        expect(send).toHaveBeenCalledWith("ctx", "prompt")
        expect(send.mock.calls[0]).toHaveLength(2)
    })

    it("falls back to the prompt on failure", async () => {
        const send = sendMock({ ok: false, error: "boom" })
        const complete = createCompleter(CONTEXT, send)
        expect(await complete("prompt")).toBe("prompt")
    })

    it("resolves the system context per call", async () => {
        const send = sendMock((context) => ({ ok: true, content: context }))
        let pageContent = "first"
        const complete = createCompleter(async () => `Page: ${pageContent}`, send)
        expect(await complete("p")).toBe("Page: first")
        pageContent = "second"
        expect(await complete("p")).toBe("Page: second")
    })

    it("caches per resolved context", async () => {
        const send = sendMock((context) => ({ ok: true, content: context }))
        let pageContent = "a"
        const complete = createCompleter(async () => `Page: ${pageContent}`, send)
        expect(await complete("p")).toBe("Page: a")
        expect(await complete("p")).toBe("Page: a")
        expect(send).toHaveBeenCalledTimes(1)
        pageContent = "b"
        expect(await complete("p")).toBe("Page: b")
        expect(send).toHaveBeenCalledTimes(2)
    })

    it("sends an empty context when resolution fails", async () => {
        const send = sendMock({ ok: true, content: "Hi" })
        const complete = createCompleter(async () => {
            throw new Error("nope")
        }, send)
        expect(await complete("p")).toBe("Hi")
        expect(send).toHaveBeenCalledWith("", "p")
    })
})
