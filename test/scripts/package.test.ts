import { execFile } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import { afterEach, beforeEach, expect, it } from "vite-plus/test"

const exec = promisify(execFile)
let root: string
beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "clipper-package-test-"))
    await mkdir(path.join(root, "scripts"))
    await cp("scripts/package.ts", path.join(root, "scripts/package.ts"))
    await writeFile(
        path.join(root, "package.json"),
        JSON.stringify({ type: "module", version: "0.1.0" }),
    )
    await Promise.all(
        ["chrome", "firefox"].map(async (target) => {
            const directory = path.join(root, "dist", target)
            await mkdir(directory, { recursive: true })
            await writeFile(
                path.join(directory, "manifest.json"),
                JSON.stringify({ version: "0.1.0" }),
            )
            await writeFile(path.join(directory, "LICENSE"), "project license")
            await writeFile(
                path.join(directory, "THIRD-PARTY-NOTICES.md"),
                "notices from the assets actually built",
            )
        }),
    )
})
afterEach(async () => {
    await rm(root, { recursive: true, force: true })
})

it("packages both browsers, includes licenses and removes stale files on a second packaging", async () => {
    const stale = path.join(root, "dist/chrome/stale.txt")
    await writeFile(stale, "old file")
    await exec(process.execPath, ["scripts/package.ts"], { cwd: root })
    await rm(stale)
    await exec(process.execPath, ["scripts/package.ts"], { cwd: root })
    await Promise.all(
        ["chrome", "firefox"].map(async (target) => {
            const zip = path.join(root, `release/datalith-clipper-${target}-v0.1.0.zip`)
            expect((await readFile(zip)).length).toBeGreaterThan(0)
            const { stdout: notices } = await exec("unzip", ["-p", zip, "THIRD-PARTY-NOTICES.md"])
            expect(notices).toBe("notices from the assets actually built")
            const { stdout: entries } = await exec("unzip", ["-Z1", zip])
            expect(entries).toContain("LICENSE")
            expect(entries).not.toContain("stale.txt")
        }),
    )
})

it("rejects a stale built manifest", async () => {
    await writeFile(
        path.join(root, "dist/chrome/manifest.json"),
        JSON.stringify({ version: "0.0.1" }),
    )
    await expect(exec(process.execPath, ["scripts/package.ts"], { cwd: root })).rejects.toThrow(
        "manifest version",
    )
})

it("rejects a missing bundled license", async () => {
    await rm(path.join(root, "dist/chrome/LICENSE"))
    await expect(exec(process.execPath, ["scripts/package.ts"], { cwd: root })).rejects.toThrow()
})

it("rejects prerelease suffixes that browser manifests do not accept", async () => {
    await writeFile(
        path.join(root, "package.json"),
        JSON.stringify({ type: "module", version: "0.1.0-rc.1" }),
    )
    await expect(exec(process.execPath, ["scripts/package.ts"], { cwd: root })).rejects.toThrow(
        "stable numeric",
    )
})
