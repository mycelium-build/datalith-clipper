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

export type ApiResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string; kind: "unreachable" | "http" }

export class ClipperApi {
    private baseUrl: string
    private token: string
    private fetchImpl: typeof fetch

    constructor(baseUrl: string, token: string, fetchImpl: typeof fetch = fetch.bind(globalThis)) {
        this.baseUrl = baseUrl.replace(/\/+$/, "")
        this.token = token
        this.fetchImpl = fetchImpl
    }

    async ping(): Promise<ApiResult<{ version?: string }>> {
        return this.request("GET", "/ping")
    }

    async vaults(): Promise<ApiResult<Vault[]>> {
        return this.request<Vault[]>("GET", "/api/vaults")
    }

    async saveNote(note: SaveNoteRequest): Promise<ApiResult<{ path: string }>> {
        return this.request("POST", "/api/notes", note)
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }
        if (this.token !== "") {
            headers.Authorization = `Bearer ${this.token}`
        }
        try {
            const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
            })
            if (!response.ok) {
                const detail = await response.json().catch(() => null)
                const message =
                    detail && typeof detail === "object" && "error" in detail
                        ? String((detail as { error: unknown }).error)
                        : `${response.status} ${response.statusText}`
                return { ok: false, error: message, kind: "http" }
            }
            return { ok: true, data: (await response.json()) as T }
        } catch {
            return { ok: false, error: "Datalith is unreachable", kind: "unreachable" }
        }
    }
}
