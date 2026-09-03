import { describe, expect, it, vi } from "vitest"

import { ClipperApi } from "../../src/lib/api"

function fetchMock(response: {
    ok?: boolean
    status?: number
    statusText?: string
    body?: unknown
}) {
    return vi.fn(
        async () =>
            new Response(JSON.stringify(response.body ?? {}), {
                status: response.status ?? (response.ok === false ? 500 : 200),
                statusText: response.statusText ?? "",
            }),
    ) as unknown as typeof fetch
}

describe("ClipperApi", () => {
    it("lists vaults", async () => {
        const api = new ClipperApi(
            "http://127.0.0.1:42908",
            "",
            fetchMock({ body: [{ name: "Notes", path: "/vaults/Notes" }] }),
        )
        const result = await api.vaults()
        expect(result.ok && result.data).toEqual([{ name: "Notes", path: "/vaults/Notes" }])
    })

    it("sends the client header and bearer token", async () => {
        const fetchImpl = fetchMock({ body: [] })
        const api = new ClipperApi("http://127.0.0.1:42908/", "secret", fetchImpl)
        await api.vaults()
        const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            RequestInit,
        ]
        expect(url).toBe("http://127.0.0.1:42908/vaults")
        const headers = init.headers as Record<string, string>
        expect(headers["X-Datalith-Client"]).toBe("clipper")
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
        expect(result).toEqual({ ok: false, error: "Unknown vault" })
    })

    it("reports unreachable servers", async () => {
        const api = new ClipperApi("http://127.0.0.1:42908", "", (() =>
            Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch)
        const result = await api.ping()
        expect(result).toEqual({ ok: false, error: "Datalith is unreachable" })
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
        const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
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
})
