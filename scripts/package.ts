/* oxlint-disable no-await-in-loop */
import { execFile } from "node:child_process"
import { mkdir, readFile, rm } from "node:fs/promises"
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
    const manifest = JSON.parse(await readFile(path.join(source, "manifest.json"), "utf8")) as {
        version: string
    }
    if (manifest.version !== version)
        throw new Error(`Rebuild ${target}: manifest version does not match package.json`)
    for (const license of ["LICENSE", "THIRD-PARTY-NOTICES.md"]) {
        if (!(await readFile(path.join(source, license), "utf8")).trim())
            throw new Error(`Missing ${license}`)
    }
    await mkdir(releaseRoot, { recursive: true })
    const output = path.join(releaseRoot, `datalith-clipper-${target}-v${version}.zip`)
    await rm(output, { force: true })
    await execFileAsync("zip", ["-r", "-X", output, "."], { cwd: source })
    console.log(`Packaged ${target} → ${path.relative(extensionRoot, output)}`)
}

async function main(): Promise<void> {
    const pkg = JSON.parse(await readFile(path.join(extensionRoot, "package.json"), "utf8")) as {
        version?: string
    }
    const version = pkg.version
    if (
        !version ||
        !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version) ||
        version.split(".").some((part) => Number(part) > 65535)
    ) {
        throw new Error(
            "Extension releases require a stable numeric x.y.z version (components <= 65535)",
        )
    }
    for (const target of targets) {
        await packageTarget(target, version)
    }
}

main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
})
