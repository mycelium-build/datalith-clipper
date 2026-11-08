export interface Vault {
    name: string
    path: string
}

export interface SaveNoteRequest {
    vault: string
    name: string
    folder?: string
    properties: Record<string, string>
    content: string
}

export const SUPPORTED_API_VERSION = 1

export type ApiResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string; kind: "unreachable" | "http" | "incompatible" }

export class ClipperApi {
    private baseUrl: string
    private token: string
    private fetchImpl: typeof fetch

    constructor(baseUrl: string, token: string, fetchImpl: typeof fetch = fetch.bind(globalThis)) {
        this.baseUrl = baseUrl.replace(/\/+$/, "")
        this.token = token
        this.fetchImpl = fetchImpl
    }

    private async checkCompatibility(): Promise<ApiResult<null>> {
        const ping = await this.request<{ api_version?: unknown } | null>("GET", "/ping")
        if (!ping.ok) return ping
        const version = ping.data?.api_version
        if (version === SUPPORTED_API_VERSION) return { ok: true, data: null }
        const outdated =
            typeof version === "number" && version > SUPPORTED_API_VERSION
                ? "Datalith Clipper"
                : "Datalith"
        return {
            ok: false,
            error: `This Clipper requires Datalith API ${SUPPORTED_API_VERSION}. Update ${outdated}.`,
            kind: "incompatible",
        }
    }

    async vaults(): Promise<ApiResult<Vault[]>> {
        const compatibility = await this.checkCompatibility()
        if (!compatibility.ok) return compatibility
        return this.request<Vault[]>("GET", "/api/vaults")
    }

    async saveNote(note: SaveNoteRequest): Promise<ApiResult<{ path: string }>> {
        const compatibility = await this.checkCompatibility()
        if (!compatibility.ok) return compatibility
        return this.request("POST", "/api/notes", note)
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }
        if (this.token !== "") {
            headers.Authorization = `Bearer ${this.token}`
        }
        let response: Response
        try {
            response = await this.fetchImpl(`${this.baseUrl}${path}`, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
            })
        } catch {
            return { ok: false, error: "Datalith is unreachable", kind: "unreachable" }
        }
        if (!response.ok) {
            const detail = await response.json().catch(() => null)
            const message =
                detail && typeof detail === "object" && "error" in detail
                    ? String((detail as { error: unknown }).error)
                    : `${response.status} ${response.statusText}`
            return { ok: false, error: message, kind: "http" }
        }
        try {
            return { ok: true, data: (await response.json()) as T }
        } catch {
            return { ok: false, error: "Malformed response from Datalith", kind: "http" }
        }
    }
}
