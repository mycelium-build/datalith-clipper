import { readFile } from "node:fs/promises"
import path from "node:path"

import { syncAssets } from "../sync-assets.ts"
import { renderNotices, siteRoot } from "./render.ts"

await syncAssets()
// Rendering validates the licenses of the current assets. Only npm notices are
// compared with the committed file: stable asset releases move independently.
const expected = await renderNotices()
const actual = await readFile(path.join(siteRoot, "THIRD-PARTY-NOTICES.md"), "utf-8")
const npmSection = (notices: string) => notices.slice(notices.indexOf("## npm dependencies\n"))
if (npmSection(actual) !== npmSection(expected)) {
    console.error("THIRD-PARTY-NOTICES.md is stale: run npm run licenses:generate")
    process.exit(1)
}

console.log("license-compliance: OK")
