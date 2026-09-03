/* oxlint-disable no-await-in-loop */
import type { Expr, Node } from "./parser"
import { parseTemplate } from "./parser"
import { applyPipe, compare, exists, looseEqual, stringify, truthy } from "./pipes"

export interface RenderOptions {
    variables: Record<string, unknown>
    resolveSelector?: (query: string, attr?: string) => string[]
    interpreter?: (prompt: string) => Promise<string>
}

export async function renderTemplate(source: string, options: RenderOptions): Promise<string> {
    const nodes = parseTemplate(source)
    const scopes: Array<Record<string, unknown>> = [options.variables]
    return renderNodes(nodes, scopes, options)
}

async function renderNodes(
    nodes: Node[],
    scopes: Array<Record<string, unknown>>,
    options: RenderOptions,
): Promise<string> {
    const parts: string[] = []
    for (const node of nodes) {
        parts.push(await renderNode(node, scopes, options))
    }
    return parts.join("")
}

async function renderNode(
    node: Node,
    scopes: Array<Record<string, unknown>>,
    options: RenderOptions,
): Promise<string> {
    switch (node.kind) {
        case "text":
            return node.value
        case "expr":
            return stringify(evaluate(node.expr, scopes, options))
        case "prompt":
            return options.interpreter ? options.interpreter(node.text) : node.text
        case "if": {
            for (const branch of node.branches) {
                if (
                    branch.condition === null ||
                    truthy(evaluate(branch.condition, scopes, options))
                ) {
                    return renderNodes(branch.body, scopes, options)
                }
            }
            return ""
        }
        case "for": {
            const iterable = evaluate(node.iterable, scopes, options)
            if (!Array.isArray(iterable)) return ""
            const parts: string[] = []
            for (let index = 0; index < iterable.length; index++) {
                const item = iterable[index]
                scopes.push({ [node.name]: item, loop: { index: index + 1 } })
                try {
                    parts.push(await renderNodes(node.body, scopes, options))
                } finally {
                    scopes.pop()
                }
            }
            return parts.join("")
        }
        case "set": {
            const value = evaluate(node.value, scopes, options)
            const top = scopes[scopes.length - 1]
            if (top) top[node.name] = value
            return ""
        }
    }
}

function evaluate(
    expr: Expr,
    scopes: Array<Record<string, unknown>>,
    options: RenderOptions,
): unknown {
    switch (expr.kind) {
        case "literal":
            return expr.value
        case "list":
            return expr.items.map((item) => evaluate(item, scopes, options))
        case "selector": {
            if (!options.resolveSelector) return []
            return options.resolveSelector(expr.query, expr.attr)
        }
        case "variable":
            return lookup(expr.path, scopes, options)
        case "unary":
            return !truthy(evaluate(expr.operand, scopes, options))
        case "binary":
            return evaluateBinary(expr, scopes, options)
        case "pipe": {
            const value = evaluate(expr.operand, scopes, options)
            const arg = expr.arg ? evaluate(expr.arg, scopes, options) : undefined
            return applyPipe(value, expr.name, arg)
        }
    }
}

function lookup(
    path: Array<string | { index: Expr }>,
    scopes: Array<Record<string, unknown>>,
    options: RenderOptions,
): unknown {
    const [first, ...rest] = path
    if (typeof first !== "string") return undefined
    let current: unknown
    for (let i = scopes.length - 1; i >= 0; i--) {
        const scope = scopes[i]
        if (scope && first in scope) {
            current = scope[first]
            break
        }
    }
    for (const step of rest) {
        if (current === undefined || current === null) return undefined
        if (typeof step === "string") {
            if (typeof current !== "object") return undefined
            current = (current as Record<string, unknown>)[step]
        } else {
            const index = evaluate(step.index, scopes, options)
            if (Array.isArray(current)) {
                const position = Math.floor(Number(index))
                current = Number.isInteger(position) ? current[position] : undefined
            } else if (typeof current === "object") {
                current = (current as Record<string, unknown>)[String(index)]
            } else {
                return undefined
            }
        }
    }
    return current
}

function evaluateBinary(
    expr: Extract<Expr, { kind: "binary" }>,
    scopes: Array<Record<string, unknown>>,
    options: RenderOptions,
): unknown {
    const left = evaluate(expr.left, scopes, options)
    switch (expr.op) {
        case "||": {
            if (truthy(left)) return left
            return evaluate(expr.right, scopes, options)
        }
        case "&&": {
            if (!truthy(left)) return left
            return evaluate(expr.right, scopes, options)
        }
        case "??": {
            if (exists(left)) return left
            return evaluate(expr.right, scopes, options)
        }
    }
    const right = evaluate(expr.right, scopes, options)
    switch (expr.op) {
        case "==":
            return looseEqual(left, right)
        case "!=":
            return !looseEqual(left, right)
        case "<":
            return compare(left, right) < 0
        case ">":
            return compare(left, right) > 0
        case "<=":
            return compare(left, right) <= 0
        case ">=":
            return compare(left, right) >= 0
        case "contains": {
            if (typeof left === "string") return left.includes(String(right ?? ""))
            if (Array.isArray(left)) return left.some((item) => looseEqual(item, right))
            return false
        }
        default:
            return false
    }
}
