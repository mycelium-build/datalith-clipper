import { describe, expect, it, vi } from "vite-plus/test"

import { ClipperApi } from "../../src/lib/api"

function fetchMock(response: {
    ok?: boolean
    status?: number
    statusText?: string
    body?: unknown
    pingBody?: unknown
}) {
    return vi.fn(async (input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : String(input)
        if (url.endsWith("/ping")) {
            return Response.json(
                response.pingBody === undefined
                    ? { app: "datalith", version: "1.2.0", api_version: 1 }
                    : response.pingBody,
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
        await api.vaults()
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
        const api = new ClipperApi("http://127.0.0.1:42908", "", () =>
            Promise.reject(new TypeError("Failed to fetch")),
        )
        const result = await api.vaults()
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
            async () =>
                new Response("<html>gateway splash</html>", {
                    status: 200,
                }),
        )
        const result = await api.vaults()
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
    it.each([
        [{ app: "datalith", version: "1.1.0" }, "Update Datalith."],
        [{ api_version: 0 }, "Update Datalith."],
        [{ api_version: 2 }, "Update Datalith Clipper."],
        [{ api_version: "1" }, "Update Datalith."],
        [null, "Update Datalith."],
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
                if (!result.ok) {
                    expect(result.error).toContain(message)
                    expect(result.kind).toBe("incompatible")
                }
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
})
