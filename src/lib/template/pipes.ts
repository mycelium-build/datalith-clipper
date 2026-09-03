import { DateTime } from "luxon"

export function truthy(value: unknown): boolean {
    if (value === undefined || value === null || value === false || value === "" || value === 0) {
        return false
    }
    if (Array.isArray(value) && value.length === 0) return false
    return true
}

export function exists(value: unknown): boolean {
    return value !== undefined && value !== null && value !== ""
}

export function stringify(value: unknown): string {
    if (value === undefined || value === null) return ""
    if (Array.isArray(value)) return value.map(stringify).join("\n\n")
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
}

export function looseEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (a == null || b == null) return false
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b)) return false
        return a.length === b.length && a.every((item, i) => looseEqual(item, b[i]))
    }
    if (typeof a === "object" || typeof b === "object") return false
    return String(a) === String(b)
}

function toNumber(value: unknown): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function isNumericPair(a: unknown, b: unknown): boolean {
    return (
        (typeof a === "number" || (typeof a === "string" && a.trim() !== "")) &&
        (typeof b === "number" || (typeof b === "string" && b.trim() !== "")) &&
        Number.isFinite(Number(a)) &&
        Number.isFinite(Number(b))
    )
}

export function compare(a: unknown, b: unknown): number {
    if (isNumericPair(a, b)) return toNumber(a) - toNumber(b)
    return String(a ?? "").localeCompare(String(b ?? ""))
}

const CALC_OPERATORS = new Set(["+", "-", "*", "/", "^"])

export function applyPipe(value: unknown, name: string, arg: unknown): unknown {
    switch (name) {
        case "calc":
            return applyCalc(value, String(arg ?? ""))
        case "length":
            if (Array.isArray(value)) return value.length
            return String(value ?? "").length
        case "round":
            if (typeof arg === "number") return Number(toNumber(value).toFixed(arg))
            return Math.round(toNumber(value))
        case "join":
            return Array.isArray(value)
                ? value.map(stringify).join(String(arg ?? ""))
                : stringify(value)
        case "merge":
            if (Array.isArray(value)) {
                return Array.isArray(arg) ? [...value, ...arg] : [...value, arg]
            }
            return stringify(value) + stringify(arg)
        case "nth": {
            const count = Math.max(0, Math.floor(toNumber(arg)))
            if (Array.isArray(value)) return value.slice(0, count)
            return String(value ?? "").slice(0, count)
        }
        case "reverse":
            if (Array.isArray(value)) return [...value].reverse()
            return String(value ?? "")
                .split("")
                .reverse()
                .join("")
        case "slice": {
            const range = Array.isArray(arg) ? arg : [arg]
            if (!Array.isArray(value) && typeof value !== "string") return value
            const start = Math.floor(toNumber(range[0]))
            const end = range.length > 1 ? Math.floor(toNumber(range[1])) : undefined
            return value.slice(start, end)
        }
        case "split":
            return String(value ?? "").split(String(arg ?? ""))
        case "unique":
            if (!Array.isArray(value)) return value
            {
                const seen = new Set<string>()
                const result: unknown[] = []
                for (const item of value) {
                    const key = stringify(item)
                    if (!seen.has(key)) {
                        seen.add(key)
                        result.push(item)
                    }
                }
                return result
            }
        case "date_modify":
            return applyDateModify(value, String(arg ?? ""))
        default:
            return value
    }
}

function applyCalc(value: unknown, spec: string): unknown {
    const match = /^\s*([+\-*/^])\s*(-?\d+(?:\.\d+)?)\s*$/.exec(spec)
    if (!match) return value
    const operator = match[1] ?? ""
    const operand = Number(match[2] ?? "0")
    if (!CALC_OPERATORS.has(operator)) return value
    const base = toNumber(value)
    switch (operator) {
        case "+":
            return base + operand
        case "-":
            return base - operand
        case "*":
            return base * operand
        case "/":
            return operand === 0 ? value : base / operand
        case "^":
            return Math.pow(base, operand)
        default:
            return value
    }
}

const UNIT_NAMES = new Set([
    "year",
    "years",
    "month",
    "months",
    "week",
    "weeks",
    "day",
    "days",
    "hour",
    "hours",
    "minute",
    "minutes",
    "second",
    "seconds",
    "millisecond",
    "milliseconds",
])

function applyDateModify(value: unknown, spec: string): unknown {
    if (typeof value !== "string" || value === "") return value
    const date = DateTime.fromISO(value, { setZone: true })
    if (!date.isValid) return value
    const match = /^\s*([+-])\s*(\d+)\s*(\w+)\s*$/.exec(spec)
    const unitName = match?.[3] ?? ""
    if (!match || !UNIT_NAMES.has(unitName)) return value
    const sign = (match[1] ?? "+") === "-" ? -1 : 1
    const amount = sign * Number(match[2] ?? "0")
    const modified = addDuration(date, match[3] ?? "", amount)
    if (!modified) return value
    if (value.length === 10) return modified.toISODate()
    return modified.toISO()
}

function addDuration(date: DateTime, name: string, amount: number): DateTime | null {
    if (name.startsWith("year")) return date.plus({ years: amount })
    if (name.startsWith("month")) return date.plus({ months: amount })
    if (name.startsWith("week")) return date.plus({ weeks: amount })
    if (name.startsWith("day")) return date.plus({ days: amount })
    if (name.startsWith("hour")) return date.plus({ hours: amount })
    if (name.startsWith("minute")) return date.plus({ minutes: amount })
    if (name.startsWith("second")) return date.plus({ seconds: amount })
    if (name.startsWith("millisecond")) return date.plus({ milliseconds: amount })
    return null
}
