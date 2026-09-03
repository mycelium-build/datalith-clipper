import type { SaveNoteRequest } from "../lib/api"
import type { InterpreterConfig } from "../lib/interpreter"

export const COMMANDS = [
    "toggle-panel",
    "toggle-highlighter",
    "toggle-reader",
    "open-settings",
] as const

export type Command = (typeof COMMANDS)[number]

export interface CommandMessage {
    type: Command
}

export type BackgroundRequest =
    | { type: "open-settings" }
    | { type: "get-vaults" }
    | { type: "save-clip"; note: SaveNoteRequest }
    | { type: "interpreter-complete"; config: InterpreterConfig; prompt: string }

export type VaultsResponse =
    | { ok: true; vaults: Array<{ name: string; path: string }> }
    | { ok: false; error: string }

export type SaveResponse =
    | { ok: true; path: string }
    | { ok: false; error: string; launched?: boolean }

export function isCommandMessage(value: unknown): value is CommandMessage {
    if (typeof value !== "object" || value === null) return false
    const type = (value as Record<string, unknown>).type
    return typeof type === "string" && (COMMANDS as readonly string[]).includes(type)
}
