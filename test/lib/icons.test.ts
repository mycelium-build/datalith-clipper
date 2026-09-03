import { describe, expect, it } from "vitest"

import { camelCase } from "../../scripts/lib/icons.ts"

describe("camelCase", () => {
    it("converts kebab-case file names", () => {
        expect(camelCase("arrow-down-a-z")).toBe("arrowDownAZ")
    })

    it("keeps simple names lowercase", () => {
        expect(camelCase("close")).toBe("close")
    })

    it("capitalizes after separators", () => {
        expect(camelCase("chevron-down")).toBe("chevronDown")
    })
})
