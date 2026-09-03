import { describe, expect, it, vi } from "vitest"

import { saveWithRetry, type SavePipelineDeps } from "../../src/background/save-pipeline"
import type { ApiResult, SaveNoteRequest } from "../../src/lib/api"

const NOTE: SaveNoteRequest = {
    vault: "Notes",
    name: "Hello",
    folder: "Clips",
    properties: { tags: "clips" },
    content: "body",
}

function deps(
    saveNote: SavePipelineDeps["saveNote"],
    overrides: Partial<SavePipelineDeps> = {},
): SavePipelineDeps & { launch: ReturnType<typeof vi.fn>; openNote: ReturnType<typeof vi.fn> } {
    const launch = vi.fn(async () => {})
    const openNote = vi.fn(async () => {})
    const base: SavePipelineDeps = {
        saveNote,
        launch,
        openNote,
        shouldOpenNote: false,
        sleep: async () => {},
        ...overrides,
    }
    return { ...base, launch, openNote }
}

const unreachable = (): ApiResult<{ path: string }> => ({
    ok: false,
    error: "Datalith is unreachable",
    kind: "unreachable",
})

const httpError = (): ApiResult<{ path: string }> => ({
    ok: false,
    error: "Unknown vault",
    kind: "http",
})

describe("saveWithRetry", () => {
    it("succeeds immediately without launching when the app is up", async () => {
        const saveNote = vi.fn(async (): Promise<ApiResult<{ path: string }>> => ({
            ok: true,
            data: { path: "Clips/Hello.md" },
        }))
        const d = deps(saveNote)
        const result = await saveWithRetry(NOTE, d)
        expect(result).toEqual({ ok: true, path: "Clips/Hello.md" })
        expect(d.launch).not.toHaveBeenCalled()
        expect(d.openNote).not.toHaveBeenCalled()
    })

    it("gives one grace attempt before launching", async () => {
        const saveNote = vi
            .fn<() => Promise<ApiResult<{ path: string }>>>()
            .mockResolvedValueOnce(unreachable())
            .mockResolvedValueOnce({ ok: true, data: { path: "Clips/Hello.md" } })
        const d = deps(saveNote)
        const result = await saveWithRetry(NOTE, d)
        expect(result.ok).toBe(true)
        expect(d.launch).not.toHaveBeenCalled()
    })

    it("launches after the grace attempt and succeeds on retry", async () => {
        const saveNote = vi
            .fn<() => Promise<ApiResult<{ path: string }>>>()
            .mockResolvedValueOnce(unreachable())
            .mockResolvedValueOnce(unreachable())
            .mockResolvedValueOnce({ ok: true, data: { path: "Clips/Hello.md" } })
        const d = deps(saveNote)
        const result = await saveWithRetry(NOTE, d)
        expect(result).toEqual({ ok: true, path: "Clips/Hello.md" })
        expect(d.launch).toHaveBeenCalledTimes(1)
    })

    it("fails without launching when the server responds with an HTTP error", async () => {
        const saveNote = vi.fn(async (): Promise<ApiResult<{ path: string }>> => httpError())
        const d = deps(saveNote)
        const result = await saveWithRetry(NOTE, d)
        expect(result).toEqual({ ok: false, error: "Unknown vault", launched: false })
        expect(d.launch).not.toHaveBeenCalled()
        expect(saveNote).toHaveBeenCalledTimes(1)
    })

    it("gives up after the retry limit and reports the launch", async () => {
        const saveNote = vi.fn(async (): Promise<ApiResult<{ path: string }>> => unreachable())
        const d = deps(saveNote, { retryLimit: 3 })
        const result = await saveWithRetry(NOTE, d)
        expect(result).toEqual({
            ok: false,
            error: "Datalith is unreachable — Datalith did not come up",
            launched: true,
        })
        expect(d.launch).toHaveBeenCalledTimes(1)
        expect(saveNote).toHaveBeenCalledTimes(4)
    })

    it("opens the saved note when saveWithoutOpening is off", async () => {
        const saveNote = vi.fn(async (): Promise<ApiResult<{ path: string }>> => ({
            ok: true,
            data: { path: "Clips/Hello.md" },
        }))
        const d = deps(saveNote, { shouldOpenNote: true })
        await saveWithRetry(NOTE, d)
        expect(d.openNote).toHaveBeenCalledWith("Clips/Hello.md")
    })

    it("does not open the note when saveWithoutOpening is on", async () => {
        const saveNote = vi.fn(async (): Promise<ApiResult<{ path: string }>> => ({
            ok: true,
            data: { path: "Clips/Hello.md" },
        }))
        const d = deps(saveNote, { shouldOpenNote: false })
        await saveWithRetry(NOTE, d)
        expect(d.openNote).not.toHaveBeenCalled()
    })
})
