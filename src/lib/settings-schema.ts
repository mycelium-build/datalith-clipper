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
    behavior: {
        saveWithoutOpening: boolean
    }
    lastUsed: {
        vault: string
        folder: string
        templateId: string
    }
}

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
