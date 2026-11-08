import { describe, expect, it, vi } from "vite-plus/test"

import { ClipRenderer } from "../../src/content/panel/clip-renderer"
import type { InterpreterResponse } from "../../src/lib/interpreter"
import { mergeDefaults, type ClipperSettings } from "../../src/lib/settings-schema"
import { DEFAULT_TEMPLATE, type Template } from "../../src/lib/templates"

function settingsWithInterpreter(
    overrides: Partial<ClipperSettings["interpreter"]> = {},
): ClipperSettings {
    return mergeDefaults({
        interpreter: {
            enabled: true,
            execOnOpen: false,
            selectedModelId: "m1",
            providers: [
                { id: "p1", name: "Test", baseUrl: "http://127.0.0.1:1234/v1", apiKey: "sk-1" },
            ],
            models: [{ id: "m1", name: "Test", modelId: "test-model", providerId: "p1" }],
            context: "Global {{domain}}",
            ...overrides,
        },
    })
}

const TEMPLATE: Template = { ...DEFAULT_TEMPLATE, context: "" }

function sendMock() {
    return vi.fn(async (): Promise<InterpreterResponse> => ({ ok: true, content: "x" }))
}

describe("ClipRenderer", () => {
    it("shares one variables object across all render phases", () => {
        const renderer = new ClipRenderer(settingsWithInterpreter(), { title: "Hello" })
        expect(renderer.draft(false).variables).toBe(renderer.variables)
        expect(renderer.preview().variables).toBe(renderer.variables)
        expect(renderer.save().variables).toBe(renderer.variables)
    })

    it("draft keeps highlights deferred and prompts raw", () => {
        const renderer = new ClipRenderer(settingsWithInterpreter(), {})
        const options = renderer.draft(false)
        expect(options.deferred).toEqual(["highlights"])
        expect(options.keepPrompts).toBe(true)
        expect(options.interpreter).toBeUndefined()
    })

    it("draft runs prompts when exec-on-open is on", () => {
        const renderer = new ClipRenderer(settingsWithInterpreter(), {})
        renderer.useTemplate(TEMPLATE)
        const options = renderer.draft(true)
        expect(options.keepPrompts).toBe(false)
        expect(options.interpreter).toBeTypeOf("function")
    })

    it("preview resolves highlights but keeps prompts as text", () => {
        const renderer = new ClipRenderer(settingsWithInterpreter(), {})
        const options = renderer.preview()
        expect(options.deferred).toBeUndefined()
        expect(options.keepPrompts).toBe(true)
    })

    it("save resolves everything including prompts", () => {
        const renderer = new ClipRenderer(settingsWithInterpreter(), {})
        renderer.useTemplate(TEMPLATE)
        expect(renderer.save().interpreter).toBeTypeOf("function")
    })

    it("reports an enabled but unconfigured interpreter, stays quiet otherwise", () => {
        const unconfigured = new ClipRenderer(
            settingsWithInterpreter({ selectedModelId: "missing" }),
            {},
        )
        expect(unconfigured.useTemplate(TEMPLATE)).toMatch(/no model is configured/)
        const disabled = new ClipRenderer(settingsWithInterpreter({ enabled: false }), {})
        expect(disabled.useTemplate(TEMPLATE)).toBeNull()
        const configured = new ClipRenderer(settingsWithInterpreter(), {})
        expect(configured.useTemplate(TEMPLATE)).toBeNull()
    })

    it("omits the interpreter when disabled or unconfigured", () => {
        const disabled = new ClipRenderer(settingsWithInterpreter({ enabled: false }), {})
        expect(disabled.useTemplate(TEMPLATE)).toBeNull()
        expect(disabled.save().interpreter).toBeUndefined()
        const unconfigured = new ClipRenderer(
            settingsWithInterpreter({ selectedModelId: "missing" }),
            {},
        )
        expect(unconfigured.save().interpreter).toBeUndefined()
    })

    it("sends the rendered template context and prompt — never provider config", async () => {
        const send = sendMock()
        const renderer = new ClipRenderer(
            settingsWithInterpreter(),
            { domain: "example.com" },
            send,
        )
        renderer.useTemplate({ ...TEMPLATE, context: "Site: {{domain}}" })
        const interpreter = renderer.draft(true).interpreter
        expect(interpreter).toBeDefined()
        await interpreter!("sum")
        expect(send).toHaveBeenCalledWith("Site: example.com", "sum")
    })

    it("uses the global context when the template has none", async () => {
        const send = sendMock()
        const renderer = new ClipRenderer(
            settingsWithInterpreter(),
            { domain: "example.com" },
            send,
        )
        renderer.useTemplate(TEMPLATE)
        const interpreter = renderer.draft(true).interpreter
        await interpreter!("p")
        expect(send).toHaveBeenCalledWith("Global example.com", "p")
    })

    it("falls back to the raw context when rendering fails", async () => {
        const send = sendMock()
        const renderer = new ClipRenderer(settingsWithInterpreter(), {}, send)
        renderer.useTemplate({ ...TEMPLATE, context: "Page {{ domain | nope }}" })
        const interpreter = renderer.draft(true).interpreter
        await interpreter!("p")
        expect(send).toHaveBeenCalledWith("Page {{ domain | nope }}", "p")
    })
})
