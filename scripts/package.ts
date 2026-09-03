/* oxlint-disable no-await-in-loop */
import { execFile } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distRoot = path.join(extensionRoot, "dist")
const releaseRoot = path.join(extensionRoot, "release")
const targets = ["chrome", "firefox"] as const

type Target = (typeof targets)[number]

async function packageTarget(target: Target, version: string): Promise<void> {
    const source = path.join(distRoot, target)
    await stat(path.join(source, "manifest.json"))
    await mkdir(releaseRoot, { recursive: true })
    const output = path.join(releaseRoot, `datalith-clipper-${target}-v${version}.zip`)
    await execFileAsync("zip", ["-r", "-X", output, "."], { cwd: source })
    console.log(`Packaged ${target} → ${path.relative(extensionRoot, output)}`)
}

async function main(): Promise<void> {
    const pkg = JSON.parse(await readFile(path.join(extensionRoot, "package.json"), "utf8")) as {
        version?: string
    }
    const version = typeof pkg.version === "string" ? pkg.version : "0.0.0"
    for (const target of targets) {
        await packageTarget(target, version)
    }
}

main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
})
