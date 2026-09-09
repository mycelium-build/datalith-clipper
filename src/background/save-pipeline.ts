/* oxlint-disable no-await-in-loop */
import type { ApiResult, SaveNoteRequest } from "../lib/api"

export const SAVE_RETRY_INTERVAL_MS = 1000
export const SAVE_RETRY_LIMIT = 20

export interface SavePipelineDeps {
    saveNote: (note: SaveNoteRequest) => Promise<ApiResult<{ path: string }>>
    launch: () => Promise<void>
    openNote: (note: SaveNoteRequest, path: string) => Promise<void>
    shouldOpenNote: boolean
    sleep?: (ms: number) => Promise<void>
    retryLimit?: number
}

export type SavePipelineResult =
    | { ok: true; path: string }
    | { ok: false; error: string; launched: boolean }

const defaultSleep = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
    })

export async function saveWithRetry(
    note: SaveNoteRequest,
    deps: SavePipelineDeps,
): Promise<SavePipelineResult> {
    const sleep = deps.sleep ?? defaultSleep
    const limit = deps.retryLimit ?? SAVE_RETRY_LIMIT
    let launched = false
    let lastError = "Datalith is unreachable"
    for (let attempt = 0; attempt <= limit; attempt++) {
        const result = await deps.saveNote(note)
        if (result.ok) {
            if (deps.shouldOpenNote) await deps.openNote(note, result.data.path)
            return { ok: true, path: result.data.path }
        }
        lastError = result.error
        if (result.kind !== "unreachable") {
            return { ok: false, error: result.error, launched }
        }
        if (attempt >= 1 && !launched) {
            launched = true
            await deps.launch()
        }
        if (attempt < limit) await sleep(SAVE_RETRY_INTERVAL_MS)
    }
    return { ok: false, error: `${lastError} — Datalith did not come up`, launched }
}
