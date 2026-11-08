import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

const state = vi.hoisted(() => ({ marker: "", clones: [] as string[][] }))
vi.mock("node:fs/promises", () => ({
    mkdir: vi.fn(),
    readFile: vi.fn(async () => state.marker),
    rm: vi.fn(async () => {
        state.marker = ""
    }),
    stat: vi.fn(async () => {
        if (!state.marker) throw new Error("missing")
    }),
    writeFile: vi.fn(async (_file: string, value: string) => {
        state.marker = value
    }),
}))
vi.mock("node:child_process", () => ({
    execFile: (
        _file: string,
        args: string[],
        callback: (error: null, stdout: string, stderr: string) => void,
    ) => {
        state.clones.push(args)
        callback(null, "", "")
    },
}))

import { resolveDatalithSource } from "../../scripts/lib/source"

const release = (tag: string) => ({ tag_name: tag, draft: false, prerelease: false })
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
    state.marker = ""
    state.clones = []
    for (const key of [
        "DATALITH_SOURCE_DIR",
        "DATALITH_SOURCE_REF",
        "CI",
        "GH_TOKEN",
        "GITHUB_TOKEN",
        "DATALITH_READ_TOKEN",
    ])
        vi.stubEnv(key, "")
})
afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe("asset source", () => {
    it("checks latest stable on each build and refreshes when it changes", async () => {
        const fetcher = vi
            .fn()
            .mockResolvedValueOnce(respond(release("v1.1.0")))
            .mockResolvedValueOnce(respond(release("v1.1.0")))
            .mockResolvedValueOnce(respond(release("v1.2.0")))
        vi.stubGlobal("fetch", fetcher)
        expect((await resolveDatalithSource()).ref).toBe("v1.1.0")
        await resolveDatalithSource()
        expect(state.clones).toHaveLength(1)
        expect((await resolveDatalithSource()).ref).toBe("v1.2.0")
        expect(state.clones).toHaveLength(2)
        expect(fetcher).toHaveBeenCalledTimes(3)
    })

    it("refreshes main on every build and does not query releases for an override", async () => {
        vi.stubEnv("DATALITH_SOURCE_REF", "main")
        const fetcher = vi.fn()
        vi.stubGlobal("fetch", fetcher)
        await resolveDatalithSource()
        await resolveDatalithSource()
        expect(state.clones).toHaveLength(2)
        expect(state.clones[0]).toContain("main")
        expect(fetcher).not.toHaveBeenCalled()
    })

    it("allows an explicit local checkout only outside CI", async () => {
        vi.stubEnv("DATALITH_SOURCE_DIR", "../datalith-app")
        expect(await resolveDatalithSource()).toEqual({
            root: path.resolve("../datalith-app"),
            ref: "local",
        })
        vi.stubEnv("CI", "true")
        await expect(resolveDatalithSource()).rejects.toThrow("must not be set in CI")
        expect(state.clones).toHaveLength(0)
    })

    it.each([
        [403, {}, "HTTP 403"],
        [200, release("v1.2.0-rc.1"), "published stable tag"],
    ])(
        "rejects a failed or invalid release lookup (%s) despite a cached tag",
        async (status, body, error) => {
            state.marker = "v1.1.0"
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body, status)))
            await expect(resolveDatalithSource()).rejects.toThrow(error)
            expect(state.clones).toHaveLength(0)
            expect(state.marker).toBe("v1.1.0")
        },
    )
})
