import { execFile } from "node:child_process"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const repository = "mycelium-build/datalith-app"
const stableTag = /^v[0-9]+\.[0-9]+\.[0-9]+$/

export interface DatalithSource {
    root: string
    ref: string
}

/** GitHub's latest published stable release; previews and drafts are never accepted. */
export async function latestStableTag(fetchImpl: typeof fetch = fetch): Promise<string> {
    const token =
        process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.DATALITH_READ_TOKEN
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/releases/latest`, {
        headers,
    })
    if (!response.ok)
        throw new Error(`Cannot find the latest Datalith release: HTTP ${response.status}`)
    const release: unknown = await response.json()
    if (
        !release ||
        typeof release !== "object" ||
        !("tag_name" in release) ||
        typeof release.tag_name !== "string" ||
        !stableTag.test(release.tag_name) ||
        !("draft" in release) ||
        release.draft !== false ||
        !("prerelease" in release) ||
        release.prerelease !== false
    )
        throw new Error("Datalith's latest release is not a published stable tag")
    return release.tag_name
}

/** Local overrides are explicit; normal builds use the latest stable release. */
export async function resolveDatalithSource(): Promise<DatalithSource> {
    const local = process.env.DATALITH_SOURCE_DIR
    if (local) {
        if (process.env.CI) throw new Error("DATALITH_SOURCE_DIR must not be set in CI")
        return { root: path.resolve(local), ref: "local" }
    }
    const ref = process.env.DATALITH_SOURCE_REF || (await latestStableTag())
    // This cache belongs to this checkout, not another project or worktree. Tags can be
    // reused; mutable refs such as main are always fetched again on the next build.
    const directory = path.join(projectRoot, ".cache", "datalith-source")
    const marker = path.join(directory, ".datalith-ref")
    if (stableTag.test(ref)) {
        try {
            await stat(path.join(directory, ".git"))
            if ((await readFile(marker, "utf8")).trim() === ref) return { root: directory, ref }
        } catch {
            // Missing or incomplete cache: clone below.
        }
    }
    await rm(directory, { recursive: true, force: true })
    await mkdir(path.dirname(directory), { recursive: true })
    await execFileAsync("git", [
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--branch",
        ref,
        `https://github.com/${repository}.git`,
        directory,
    ])
    await writeFile(marker, ref)
    return { root: directory, ref }
}
