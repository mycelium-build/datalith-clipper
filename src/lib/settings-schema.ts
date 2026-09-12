import { LAST_USED_VAULT, type Template } from "./templates"

export const DEFAULT_BASE_URL = "http://127.0.0.1:42908"

export type AppearanceMode = "auto" | "light" | "dark"

export interface InterpreterProvider {
    id: string
    name: string
    baseUrl: string
    apiKey: string
}

export interface InterpreterModel {
    id: string
    name: string
    modelId: string
    providerId: string
}

export interface InterpreterSettings {
    enabled: boolean
    execOnOpen: boolean
    selectedModelId: string
    providers: InterpreterProvider[]
    models: InterpreterModel[]
    context: string
}

export interface ClipperSettings {
    version: 1
    connection: {
        baseUrl: string
        token: string
    }
    appearance: {
        mode: AppearanceMode
        light: string
        dark: string
    }
    reader: {
        font: string
        fontSize: number
        lineHeight: number
        colorLinks: boolean
    }
    interpreter: InterpreterSettings
    behavior: {
        saveWithoutOpening: boolean
    }
    lastUsed: {
        vault: string
        folder: string
        templateId: string
    }
    templates: Template[]
}

export const READER_FONTS: Array<{ label: string; stack: string }> = [
    { label: "System", stack: "" },
    { label: "Serif", stack: 'Georgia, "Times New Roman", serif' },
    { label: "Sans", stack: 'system-ui, "Segoe UI", Roboto, sans-serif' },
    { label: "Mono", stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
]

const READER_SYSTEM_STACK = 'system-ui, "Segoe UI", Roboto, sans-serif'

export function readerStyleVars(settings: ClipperSettings): Record<string, string> {
    return {
        "--reader-font": settings.reader.font === "" ? READER_SYSTEM_STACK : settings.reader.font,
        "--reader-size": `${settings.reader.fontSize}px`,
        "--reader-line-height": String(settings.reader.lineHeight),
        "--reader-link-color": settings.reader.colorLinks ? "var(--dl-accent)" : "inherit",
    }
}

export const READER_DEFAULTS = {
    font: "",
    fontSize: 16,
    lineHeight: 1.6,
    colorLinks: false,
} as const

export const DEFAULT_INTERPRETER_CONTEXT = "Page content:\n<content>\n{{content}}\n</content>"

export const DEFAULT_SETTINGS: ClipperSettings = {
    version: 1,
    connection: {
        baseUrl: DEFAULT_BASE_URL,
        token: "",
    },
    appearance: {
        mode: "auto",
        light: "datalith-light",
        dark: "datalith-dark",
    },
    reader: { ...READER_DEFAULTS },
    interpreter: {
        enabled: false,
        execOnOpen: false,
        selectedModelId: "",
        providers: [],
        models: [],
        context: DEFAULT_INTERPRETER_CONTEXT,
    },
    behavior: {
        saveWithoutOpening: true,
    },
    lastUsed: {
        vault: "",
        folder: "",
        templateId: "default",
    },
    templates: [],
}

function pick<T>(value: T | undefined, fallback: T): T {
    return value === undefined || value === "" ? fallback : value
}

function pickNumber(value: number | undefined, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function pickString(value: unknown, fallback: string): string {
    return typeof value === "string" ? value : fallback
}

function hasId(value: unknown): value is { id: string } {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as { id?: unknown }).id === "string" &&
        (value as { id: string }).id !== ""
    )
}

function sanitizeProviders(value: unknown): InterpreterProvider[] {
    if (!Array.isArray(value)) return []
    const result: InterpreterProvider[] = []
    for (const provider of value) {
        if (!hasId(provider)) continue
        const candidate = provider as Record<string, unknown>
        result.push({
            id: provider.id,
            name: pickString(candidate.name, ""),
            baseUrl: pickString(candidate.baseUrl, ""),
            apiKey: pickString(candidate.apiKey, ""),
        })
    }
    return result
}

function sanitizeModels(value: unknown, providerIds: ReadonlySet<string>): InterpreterModel[] {
    if (!Array.isArray(value)) return []
    const result: InterpreterModel[] = []
    for (const model of value) {
        if (!hasId(model)) continue
        const candidate = model as Record<string, unknown>
        const providerId = candidate.providerId
        if (typeof providerId !== "string" || providerId === "") continue
        // A model pointing at a provider that is missing or was dropped is unusable.
        if (!providerIds.has(providerId)) continue
        result.push({
            id: model.id,
            name: pickString(candidate.name, ""),
            modelId: pickString(candidate.modelId, ""),
            providerId,
        })
    }
    return result
}

function sanitizeTemplateProperties(value: unknown): Template["properties"] {
    if (!Array.isArray(value)) return []
    const result: Template["properties"] = []
    for (const property of value) {
        if (typeof property !== "object" || property === null) continue
        const candidate = property as Record<string, unknown>
        result.push({
            name: pickString(candidate.name, ""),
            value: pickString(candidate.value, ""),
        })
    }
    return result
}

function sanitizeTemplates(value: unknown): Template[] {
    if (!Array.isArray(value)) return []
    const result: Template[] = []
    for (const template of value) {
        if (!hasId(template)) continue
        const candidate = template as Record<string, unknown>
        result.push({
            id: template.id,
            name: pickString(candidate.name, ""),
            trigger: pickString(candidate.trigger, ""),
            noteName: pickString(candidate.noteName, "{{title}}"),
            noteFolder: pickString(candidate.noteFolder, "Clips"),
            vault: pickString(candidate.vault, LAST_USED_VAULT),
            properties: sanitizeTemplateProperties(candidate.properties),
            content: pickString(candidate.content, "{{content}}"),
            context: pickString(candidate.context, ""),
        })
    }
    return result
}

export function splitBaseUrl(baseUrl: string): { url: string; port: string } {
    try {
        const parsed = new URL(baseUrl)
        return { url: `${parsed.protocol}//${parsed.hostname}`, port: parsed.port }
    } catch {
        return { url: "", port: "" }
    }
}

export function composeBaseUrl(url: string, port: string): string | null {
    let host = url.trim().replace(/\/+$/, "")
    if (host === "") return null
    const trimmedPort = port.trim()
    if (trimmedPort !== "") {
        if (!isValidPort(trimmedPort)) return null
        host = host.replace(/:\d{1,5}$/, "")
    }
    const withScheme = /^https?:\/\//i.test(host) ? host : `http://${host}`
    return normalizeOrigin(withScheme, trimmedPort)
}

function normalizeOrigin(host: string, port: string): string | null {
    const base = port === "" ? host : `${host}:${port}`
    try {
        const parsed = new URL(base)
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
        return parsed.origin
    } catch {
        return null
    }
}

export const PORT_MIN = 1
export const PORT_MAX = 65535

export function isValidPort(value: string): boolean {
    if (!/^\d{1,5}$/.test(value)) return false
    const port = Number(value)
    return Number.isInteger(port) && port >= PORT_MIN && port <= PORT_MAX
}

export function mergeDefaults(stored: Partial<ClipperSettings> | undefined): ClipperSettings {
    const defaults = structuredClone(DEFAULT_SETTINGS)
    if (!stored) return defaults
    const interpreterProviders = sanitizeProviders(stored.interpreter?.providers)
    return {
        version: 1,
        connection: {
            baseUrl: pick(stored.connection?.baseUrl, defaults.connection.baseUrl),
            token: stored.connection?.token ?? defaults.connection.token,
        },
        appearance: {
            mode: stored.appearance?.mode ?? defaults.appearance.mode,
            light: pick(stored.appearance?.light, defaults.appearance.light),
            dark: pick(stored.appearance?.dark, defaults.appearance.dark),
        },
        reader: {
            font: pick(stored.reader?.font, defaults.reader.font),
            fontSize: pickNumber(stored.reader?.fontSize, defaults.reader.fontSize),
            lineHeight: pickNumber(stored.reader?.lineHeight, defaults.reader.lineHeight),
            colorLinks: stored.reader?.colorLinks ?? defaults.reader.colorLinks,
        },
        interpreter: {
            enabled: stored.interpreter?.enabled ?? defaults.interpreter.enabled,
            execOnOpen: stored.interpreter?.execOnOpen ?? defaults.interpreter.execOnOpen,
            selectedModelId:
                stored.interpreter?.selectedModelId ?? defaults.interpreter.selectedModelId,
            providers: interpreterProviders,
            models: sanitizeModels(
                stored.interpreter?.models,
                new Set(interpreterProviders.map((provider) => provider.id)),
            ),
            context: pick(stored.interpreter?.context, defaults.interpreter.context),
        },
        behavior: {
            saveWithoutOpening:
                stored.behavior?.saveWithoutOpening ?? defaults.behavior.saveWithoutOpening,
        },
        lastUsed: {
            vault: pick(stored.lastUsed?.vault, defaults.lastUsed.vault),
            folder: pick(stored.lastUsed?.folder, defaults.lastUsed.folder),
            templateId: pick(stored.lastUsed?.templateId, defaults.lastUsed.templateId),
        },
        templates: sanitizeTemplates(stored.templates),
    }
}

export interface ThemeChoice {
    id: string
    mode: "light" | "dark"
}

export function resolveTheme(settings: ClipperSettings): ThemeChoice {
    if (settings.appearance.mode === "light") {
        return { id: settings.appearance.light, mode: "light" }
    }
    if (settings.appearance.mode === "dark") {
        return { id: settings.appearance.dark, mode: "dark" }
    }
    const prefersDark =
        typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
    return prefersDark
        ? { id: settings.appearance.dark, mode: "dark" }
        : { id: settings.appearance.light, mode: "light" }
}
