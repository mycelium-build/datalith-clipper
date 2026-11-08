import { mergeDefaults, type ClipperSettings } from "../lib/settings-schema"
import { DEFAULT_TEMPLATES, type Template } from "../lib/templates"

export interface OptionsState {
    settings: ClipperSettings
}

export interface PageContext {
    state: OptionsState
    save: () => Promise<void>
    rerender: () => void
    applyTheme: () => void
    navigate: (hash: string) => void
}

export function importSettings(json: unknown): ClipperSettings {
    const raw =
        json !== null && typeof json === "object" && "settings" in json ? json.settings : json
    return mergeDefaults(raw as Partial<ClipperSettings>)
}

export function exportPayload(state: OptionsState): string {
    return JSON.stringify({ settings: state.settings }, null, 4)
}

export function uniqueId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID?.() ?? Date.now().toString(36)}`
}

export function ensureStoredTemplates(ctx: PageContext): Template[] {
    if (ctx.state.settings.templates.length === 0) {
        ctx.state.settings.templates = structuredClone(DEFAULT_TEMPLATES)
    }
    return ctx.state.settings.templates
}
