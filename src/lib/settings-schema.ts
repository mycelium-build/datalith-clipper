export const DEFAULT_BASE_URL = "http://127.0.0.1:42908"

export type AppearanceMode = "auto" | "light" | "dark"

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
    behavior: {
        saveWithoutOpening: boolean
    }
    lastUsed: {
        vault: string
        folder: string
        templateId: string
    }
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
    behavior: {
        saveWithoutOpening: true,
    },
    lastUsed: {
        vault: "",
        folder: "",
        templateId: "default",
    },
}

function pick<T>(value: T | undefined, fallback: T): T {
    return value === undefined || value === "" ? fallback : value
}

function pickNumber(value: number | undefined, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export function mergeDefaults(stored: Partial<ClipperSettings> | undefined): ClipperSettings {
    const defaults = structuredClone(DEFAULT_SETTINGS)
    if (!stored) return defaults
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
        behavior: {
            saveWithoutOpening:
                stored.behavior?.saveWithoutOpening ?? defaults.behavior.saveWithoutOpening,
        },
        lastUsed: {
            vault: pick(stored.lastUsed?.vault, defaults.lastUsed.vault),
            folder: pick(stored.lastUsed?.folder, defaults.lastUsed.folder),
            templateId: pick(stored.lastUsed?.templateId, defaults.lastUsed.templateId),
        },
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
