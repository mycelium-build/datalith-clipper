import { describe, expect, it } from "vitest"

import {
    composeBaseUrl,
    DEFAULT_SETTINGS,
    isValidPort,
    mergeDefaults,
    splitBaseUrl,
} from "../../src/lib/settings-schema"

describe("mergeDefaults", () => {
    it("returns defaults when nothing is stored", () => {
        expect(mergeDefaults(undefined)).toEqual(DEFAULT_SETTINGS)
    })

    it("fills missing sections from defaults", () => {
        const merged = mergeDefaults({
            connection: { baseUrl: "http://127.0.0.1:1234", token: "" },
        })
        expect(merged.connection.baseUrl).toBe("http://127.0.0.1:1234")
        expect(merged.appearance.mode).toBe("auto")
        expect(merged.behavior.saveWithoutOpening).toBe(true)
        expect(merged.lastUsed.templateId).toBe("default")
    })

    it("merges partial nested sections", () => {
        const merged = mergeDefaults({
            appearance: { mode: "dark", light: "", dark: "matrix" },
        })
        expect(merged.appearance.mode).toBe("dark")
        expect(merged.appearance.light).toBe("datalith-light")
        expect(merged.appearance.dark).toBe("matrix")
    })
})

describe("splitBaseUrl", () => {
    it("splits origin and port", () => {
        expect(splitBaseUrl("http://127.0.0.1:42908")).toEqual({
            url: "http://127.0.0.1",
            port: "42908",
        })
    })

    it("returns an empty port for scheme default ports", () => {
        expect(splitBaseUrl("https://datalith.example.com")).toEqual({
            url: "https://datalith.example.com",
            port: "",
        })
    })

    it("returns empty parts for invalid URLs", () => {
        expect(splitBaseUrl("not a url")).toEqual({ url: "", port: "" })
    })
})

describe("composeBaseUrl", () => {
    it("joins url and port", () => {
        expect(composeBaseUrl("http://127.0.0.1", "42908")).toBe("http://127.0.0.1:42908")
    })

    it("adds the http scheme when missing", () => {
        expect(composeBaseUrl("127.0.0.1", "42908")).toBe("http://127.0.0.1:42908")
    })

    it("prefers the port field over a port typed into the url", () => {
        expect(composeBaseUrl("http://127.0.0.1:1234", "42908")).toBe("http://127.0.0.1:42908")
    })

    it("keeps the url port when the port field is empty", () => {
        expect(composeBaseUrl("http://127.0.0.1:1234/", "")).toBe("http://127.0.0.1:1234")
    })

    it("normalizes trailing slashes and casing", () => {
        expect(composeBaseUrl("HTTP://LocalHost/", "42908")).toBe("http://localhost:42908")
    })

    it("rejects empty urls, missing ports, and out of range ports", () => {
        expect(composeBaseUrl("", "42908")).toBeNull()
        expect(composeBaseUrl("http://127.0.0.1", "")).toBeNull()
        expect(composeBaseUrl("http://127.0.0.1", "0")).toBeNull()
        expect(composeBaseUrl("http://127.0.0.1", "65536")).toBeNull()
    })

    it("round trips through splitBaseUrl", () => {
        const split = splitBaseUrl("http://127.0.0.1:42908")
        expect(composeBaseUrl(split.url, split.port)).toBe("http://127.0.0.1:42908")
    })
})

describe("isValidPort", () => {
    it("accepts integers within 1 and 65535", () => {
        expect(isValidPort("1")).toBe(true)
        expect(isValidPort("42908")).toBe(true)
        expect(isValidPort("65535")).toBe(true)
    })

    it("rejects empty, non numeric, and out of range values", () => {
        expect(isValidPort("")).toBe(false)
        expect(isValidPort("abc")).toBe(false)
        expect(isValidPort("0")).toBe(false)
        expect(isValidPort("65536")).toBe(false)
        expect(isValidPort("4.5")).toBe(false)
    })
})
