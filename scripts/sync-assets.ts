/* oxlint-disable no-await-in-loop */
import { copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

import { resolveDatalithSource } from "./lib/source.ts"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const copies = [
    { from: path.join("assets", "logo", "datalith.txt"), to: path.join("src", "data", "logo.txt") },
    { from: path.join("assets", "fonts", "Pixeloid"), to: path.join("public", "fonts") },
    { from: path.join("assets", "themes"), to: path.join("src", "data", "themes") },
    { from: path.join("assets", "icons"), to: path.join("src", "assets", "icons") },
]

const extensions = /\.(svg|json|txt|ttf)$/i

async function copyTree(sourcePath: string, destinationPath: string): Promise<number> {
    const info = await stat(sourcePath)
    if (info.isFile()) {
        await mkdir(path.dirname(destinationPath), { recursive: true })
        await copyFile(sourcePath, destinationPath)
        return 1
    }
    await mkdir(destinationPath, { recursive: true })
    let count = 0
    for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
        if (!extensions.test(entry.name)) continue
        count += await copyTree(
            path.join(sourcePath, entry.name),
            path.join(destinationPath, entry.name),
        )
    }
    return count
}

/** Refresh the bundled assets and report their source for release notes. */
export async function syncAssets(): Promise<string> {
    const { root: sourceRoot, ref } = await resolveDatalithSource()
    let copiedCount = 0

    for (const { from, to } of copies) {
        const sourcePath = path.join(sourceRoot, from)
        const destinationPath = path.join(siteRoot, to)
        await rm(destinationPath, { recursive: true, force: true })
        copiedCount += await copyTree(sourcePath, destinationPath)
    }

    const clipperSource = path.join(sourceRoot, "assets", "icons", "clipper.svg")
    const iconsDestination = path.join(siteRoot, "public", "icons")
    await mkdir(iconsDestination, { recursive: true })
    const ACCENT = "#1e8dff"
    const clipperSvg = (await readFile(clipperSource, "utf8")).replaceAll(
        'fill="currentColor"',
        `fill="${ACCENT}"`,
    )
    for (const [size, cells, pad] of [
        [16, 2, 1],
        [48, 6, 3],
        [128, 18, 1],
    ] as const) {
        const inner = cells * 7
        await sharp(Buffer.from(clipperSvg))
            .resize(inner, inner, { kernel: "nearest" })
            .extend({
                top: pad,
                bottom: pad,
                left: pad,
                right: pad,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .toFile(path.join(iconsDestination, `icon-${size}.png`))
    }
    console.log(`Synced ${copiedCount} asset files and extension icons from Datalith ${ref}`)
    return ref
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await syncAssets()
}
