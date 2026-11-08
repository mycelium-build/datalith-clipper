/* oxlint-disable no-await-in-loop */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { build, type BuildOptions } from "rolldown"

import { buildIcons } from "./build-icons.ts"
import { buildThemes } from "./build-themes.ts"
import { renderNotices } from "./licenses/render.ts"
import { syncAssets } from "./sync-assets.ts"

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distRoot = path.join(extensionRoot, "dist")
const targets = ["chrome", "firefox"] as const

type Target = (typeof targets)[number]

// Replaced wholesale when merging browser patches (never deep-merged).
const REPLACE_KEYS = new Set(["background"])

interface JsonValue {
    [key: string]: JsonValue | JsonValue[] | string | number | boolean | null
}

function mergeJson(base: JsonValue, patch: JsonValue): JsonValue {
    const result: JsonValue = { ...base }
    for (const [key, value] of Object.entries(patch)) {
        const current = result[key]
        if (!REPLACE_KEYS.has(key) && isObject(current) && isObject(value) && key in result) {
            result[key] = mergeJson(current, value)
        } else {
            result[key] = value
        }
    }
    return result
}

function isObject(
    value: JsonValue | JsonValue[] | string | number | boolean | null | undefined,
): value is JsonValue {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function readJson(file: string): Promise<JsonValue> {
    return JSON.parse(await readFile(file, "utf8")) as JsonValue
}

async function writeManifest(target: Target): Promise<void> {
    const pkg = await readJson(path.join(extensionRoot, "package.json"))
    let manifest = { ...(await readJson(path.join(extensionRoot, "src", "manifest.json"))) }
    const version = typeof pkg.version === "string" ? pkg.version : "0.0.0"
    manifest.version = version
    const patchPath = path.join(extensionRoot, "src", `manifest.${target}.json`)
    try {
        const patch = await readJson(patchPath)
        manifest = mergeJson(manifest, patch)
    } catch {
        // No browser-specific patch for this target.
    }
    await writeFile(
        path.join(distRoot, target, "manifest.json"),
        `${JSON.stringify(manifest, null, 4)}\n`,
    )
}

async function bundle(target: Target, watch: boolean): Promise<void> {
    const dir = path.join(distRoot, target)
    const entry = (source: string): string => path.join(extensionRoot, "src", source)
    const options: BuildOptions[] = [
        {
            input: { "background/main": entry("background/main.ts") },
            moduleTypes: { ".css": "text" },
            output: { dir, format: "iife", sourcemap: "inline", entryFileNames: "[name].js" },
        },
        {
            input: { "content/main": entry("content/main.ts") },
            moduleTypes: { ".css": "text" },
            output: { dir, format: "iife", sourcemap: "inline", entryFileNames: "[name].js" },
        },
        {
            input: { "options/options": entry("options/main.ts") },
            moduleTypes: { ".css": "text" },
            output: { dir, format: "iife", sourcemap: "inline", entryFileNames: "[name].js" },
        },
    ]
    if (watch) {
        for (const option of options) option.watch = {}
    }
    await build(options)
}

async function copyStatic(target: Target, notices: string): Promise<void> {
    const dir = path.join(distRoot, target)
    await mkdir(path.join(dir, "options"), { recursive: true })
    await mkdir(path.join(dir, "styles"), { recursive: true })
    await cp(
        path.join(extensionRoot, "src", "options", "options.html"),
        path.join(dir, "options", "options.html"),
    )
    for (const file of await readdir(path.join(extensionRoot, "src", "styles"))) {
        if (!file.endsWith(".css")) continue
        await cp(path.join(extensionRoot, "src", "styles", file), path.join(dir, "styles", file))
    }
    await cp(path.join(extensionRoot, "LICENSE"), path.join(dir, "LICENSE"))
    await writeFile(path.join(dir, "THIRD-PARTY-NOTICES.md"), notices)
    const publicDirectory = path.join(extensionRoot, "public")
    await cp(publicDirectory, dir, { recursive: true })
}

async function main(): Promise<void> {
    const watch = process.argv.includes("--watch")
    await syncAssets()
    await buildThemes()
    await buildIcons()
    const notices = await renderNotices()
    // Remove stale files as well as updating existing ones.
    await rm(distRoot, { recursive: true, force: true })

    for (const target of targets) {
        await mkdir(path.join(distRoot, target), { recursive: true })
        await writeManifest(target)
        await copyStatic(target, notices)
        await bundle(target, watch)
        console.log(`Built ${target} → dist/${target}`)
    }
    if (watch) {
        console.log("Watching for changes…")
    }
}

main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
})
