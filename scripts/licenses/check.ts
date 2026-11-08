import { readFile } from "node:fs/promises"
import path from "node:path"

import { renderNotices, renderNpmDependencies, siteRoot } from "./render.ts"

const dependenciesOnly = process.argv.includes("--dependencies-only")
const expected = dependenciesOnly ? await renderNpmDependencies() : await renderNotices()
const actual = await readFile(path.join(siteRoot, "THIRD-PARTY-NOTICES.md"), "utf-8")

const compared = dependenciesOnly ? actual.slice(actual.indexOf("## npm dependencies\n")) : actual
if (compared !== expected) {
    console.error("THIRD-PARTY-NOTICES.md is stale: run npm run licenses:generate")
    process.exit(1)
}

console.log("license-compliance: OK")
