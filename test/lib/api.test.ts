import { describe, expect, it, vi } from "vitest"

import { saveWithRetry } from "../../src/background/save-pipeline"
import { ClipperApi } from "../../src/lib/api"

function fetchMock(response: {
    ok?: boolean
    status?: number
    statusText?: string
    body?: unknown
    pingBody?: unknown
}) {
    return vi.fn(async (input: string | URL | Request) => {
        if (String(input).endsWith("/ping")) {
            return Response.json(
                response.pingBody ?? { app: "datalith", version: "1.2.0", api_version: 1 },
            )
        }
        return new Response(JSON.stringify(response.body ?? {}), {
            status: response.status ?? (response.ok === false ? 500 : 200),
            statusText: response.statusText ?? "",
        })
    }) as unknown as typeof fetch
}

describe("ClipperApi", () => {
    it("binds the default fetch so receiver-bound calls stay legal in workers", () => {
        const api = new ClipperApi("http://127.0.0.1:42908", "")
        const fetchImpl = (api as unknown as { fetchImpl: typeof fetch }).fetchImpl
        expect(fetchImpl).not.toBe(fetch)
    })

    it("lists vaults", async () => {
        const api = new ClipperApi(
            "http://127.0.0.1:42908",
            "",
            fetchMock({ body: [{ name: "Notes", path: "/vaults/Notes" }] }),
        )
        const result = await api.vaults()
        expect(result.ok && result.data).toEqual([{ name: "Notes", path: "/vaults/Notes" }])
    })

    it("checks compatibility before the vaults path and sends the bearer token", async () => {
        const fetchImpl = fetchMock({ body: [] })
        const api = new ClipperApi("http://127.0.0.1:42908/", "secret", fetchImpl)
        await api.vaults()
        const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[1] as [
            string,
            RequestInit,
        ]
        expect(url).toBe("http://127.0.0.1:42908/api/vaults")
        const headers = init.headers as Record<string, string>
        expect(headers.Authorization).toBe("Bearer secret")
    })

    it("omits the Authorization header without a token", async () => {
        const fetchImpl = fetchMock({ body: [] })
        const api = new ClipperApi("http://127.0.0.1:42908", "", fetchImpl)
        await api.ping()
        const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            RequestInit,
        ]
        expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
    })

    it("surfaces API error messages", async () => {
        const api = new ClipperApi(
            "http://127.0.0.1:42908",
            "",
            fetchMock({ ok: false, status: 404, body: { error: "Unknown vault" } }),
        )
        const result = await api.saveNote({
            vault: "Missing",
            name: "Note",
            properties: {},
            content: "body",
        })
        expect(result).toEqual({ ok: false, error: "Unknown vault", kind: "http" })
    })

    it("reports unreachable servers", async () => {
        const api = new ClipperApi("http://127.0.0.1:42908", "", (() =>
            Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch)
        const result = await api.ping()
        expect(result).toEqual({
            ok: false,
            error: "Datalith is unreachable",
            kind: "unreachable",
        })
    })

    it("reports non-JSON success bodies as malformed, not unreachable", async () => {
        const api = new ClipperApi(
            "http://127.0.0.1:42908",
            "",
            (async () =>
                new Response("<html>gateway splash</html>", {
                    status: 200,
                })) as unknown as typeof fetch,
        )
        const result = await api.ping()
        expect(result).toEqual({
            ok: false,
            error: "Malformed response from Datalith",
            kind: "http",
        })
    })

    it("posts notes with name, folder, properties and content", async () => {
        const fetchImpl = fetchMock({ body: { path: "Clips/Hello.md" } })
        const api = new ClipperApi("http://127.0.0.1:42908", "", fetchImpl)
        const result = await api.saveNote({
            vault: "Notes",
            name: "Hello",
            folder: "Clips",
            properties: { tags: "clips" },
            content: "body",
        })
        expect(result.ok && result.data.path).toBe("Clips/Hello.md")
        const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[1] as [
            string,
            RequestInit,
        ]
        expect(JSON.parse(init.body as string)).toEqual({
            vault: "Notes",
            name: "Hello",
            folder: "Clips",
            properties: { tags: "clips" },
            content: "body",
        })
    })
    it("accepts API 1 regardless of the app release version", async () => {
        const api = new ClipperApi(
            "http://127.0.0.1:42908",
            "",
            fetchMock({
                pingBody: { app: "datalith", version: "2.0.0-rc.1", api_version: 1 },
            }),
        )
        expect(await api.ping()).toEqual({
            ok: true,
            data: { app: "datalith", version: "2.0.0-rc.1", api_version: 1 },
        })
    })

    it.each([
        [{ app: "datalith", version: "1.1.0" }, "Update Datalith to use this Clipper"],
        [{ app: "datalith", version: "2.0.0", api_version: 2 }, "Update Datalith Clipper"],
        [{ app: "datalith", version: "1.2.0", api_version: "1" }, "Malformed API version"],
        [{ app: "datalith", version: "1.2.0", api_version: 1.5 }, "Malformed API version"],
        [{ app: "datalith", version: "1.2.0", api_version: 0 }, "Malformed API version"],
        [{ app: "other", version: "1.2.0", api_version: 1 }, "Malformed response"],
        [[], "Malformed response"],
    ])(
        "blocks vault listing and note writes for invalid handshake %j",
        async (pingBody, message) => {
            const fetchImpl = fetchMock({ pingBody })
            const api = new ClipperApi("http://127.0.0.1:42908", "", fetchImpl)
            const vaults = await api.vaults()
            const save = await api.saveNote({
                vault: "Notes",
                name: "Hello",
                properties: {},
                content: "body",
            })
            for (const result of [vaults, save]) {
                expect(result.ok).toBe(false)
                if (!result.ok) expect(result.error).toContain(message)
            }
            const calls = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls
            expect(calls).toHaveLength(2)
            expect(
                calls.every(
                    ([url, init]) => String(url).endsWith("/ping") && init.method === "GET",
                ),
            ).toBe(true)
        },
    )

    it("rechecks compatibility when the app restarts with another API", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(
                Response.json({ app: "datalith", version: "1.2.0", api_version: 1 }),
            )
            .mockResolvedValueOnce(Response.json([]))
            .mockResolvedValueOnce(
                Response.json({ app: "datalith", version: "2.0.0", api_version: 2 }),
            )
        const api = new ClipperApi("http://127.0.0.1:42908", "", fetchImpl as typeof fetch)
        expect((await api.vaults()).ok).toBe(true)
        expect(
            (await api.saveNote({ vault: "Notes", name: "Hello", properties: {}, content: "body" }))
                .ok,
        ).toBe(false)
        expect(fetchImpl).toHaveBeenCalledTimes(3)
    })

    it("still launches an unreachable app and saves after a compatible handshake", async () => {
        const fetchImpl = vi
            .fn()
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(
                Response.json({ app: "datalith", version: "1.2.0", api_version: 1 }),
            )
            .mockResolvedValueOnce(Response.json({ path: "Hello.md" }))
        const api = new ClipperApi("http://127.0.0.1:42908", "", fetchImpl as typeof fetch)
        const launch = vi.fn(async () => {})
        const result = await saveWithRetry(
            { vault: "Notes", name: "Hello", properties: {}, content: "body" },
            {
                saveNote: (note) => api.saveNote(note),
                launch,
                openNote: async () => {},
                shouldOpenNote: false,
                sleep: async () => {},
                retryLimit: 3,
            },
        )
        expect(result).toEqual({ ok: true, path: "Hello.md" })
        expect(launch).toHaveBeenCalledOnce()
        expect(fetchImpl.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1)
    })

    it("does not launch or retry an incompatible app", async () => {
        const fetchImpl = fetchMock({ pingBody: { app: "datalith", version: "1.1.0" } })
        const api = new ClipperApi("http://127.0.0.1:42908", "", fetchImpl)
        const launch = vi.fn(async () => {})
        const result = await saveWithRetry(
            { vault: "Notes", name: "Hello", properties: {}, content: "body" },
            {
                saveNote: (note) => api.saveNote(note),
                launch,
                openNote: async () => {},
                shouldOpenNote: false,
                sleep: async () => {},
            },
        )
        expect(result.ok).toBe(false)
        expect(launch).not.toHaveBeenCalled()
        expect(fetchImpl).toHaveBeenCalledOnce()
    })
})
