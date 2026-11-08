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

export interface PingResponse {
    app: "datalith"
    version: string
    apiVersion: number
}

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

    async ping(): Promise<ApiResult<PingResponse>> {
        const result = await this.request<unknown>("GET", "/ping")
        if (!result.ok) return result
        const data = result.data
        if (
            !data ||
            typeof data !== "object" ||
            !("app" in data) ||
            data.app !== "datalith" ||
            !("version" in data) ||
            typeof data.version !== "string"
        ) {
            return { ok: false, error: "Malformed response from Datalith", kind: "http" }
        }
        if (!("apiVersion" in data)) {
            return {
                ok: false,
                error: "This Datalith app does not report an API version. Update Datalith to use this Clipper.",
                kind: "incompatible",
            }
        }
        if (
            typeof data.apiVersion !== "number" ||
            !Number.isInteger(data.apiVersion) ||
            data.apiVersion < 1
        ) {
            return { ok: false, error: "Malformed API version from Datalith", kind: "http" }
        }
        if (data.apiVersion !== SUPPORTED_API_VERSION) {
            return {
                ok: false,
                error: `Datalith API ${data.apiVersion} is not supported by this Clipper (API ${SUPPORTED_API_VERSION}). Update Datalith Clipper.`,
                kind: "incompatible",
            }
        }
        return {
            ok: true,
            data: { app: "datalith", version: data.version, apiVersion: data.apiVersion },
        }
    }

    async vaults(): Promise<ApiResult<Vault[]>> {
        const compatibility = await this.ping()
        if (!compatibility.ok) return compatibility
        return this.request<Vault[]>("GET", "/api/vaults")
    }

    async saveNote(note: SaveNoteRequest): Promise<ApiResult<{ path: string }>> {
        const compatibility = await this.ping()
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
