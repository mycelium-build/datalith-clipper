export type BinOp = "||" | "&&" | "==" | "!=" | "<" | ">" | "<=" | ">=" | "contains" | "??"

export type Expr =
    | { kind: "literal"; value: string | number | boolean | null }
    | { kind: "list"; items: Expr[] }
    | { kind: "variable"; path: Array<string | { index: Expr }> }
    | { kind: "selector"; query: string; attr?: string }
    | { kind: "unary"; op: "!"; operand: Expr }
    | { kind: "binary"; op: BinOp; left: Expr; right: Expr }
    | { kind: "pipe"; operand: Expr; name: string; arg?: Expr }

export type Node =
    | { kind: "text"; value: string }
    | { kind: "expr"; expr: Expr; raw: string }
    | { kind: "prompt"; text: string; raw: string }
    | { kind: "if"; branches: Array<{ condition: Expr | null; body: Node[] }> }
    | { kind: "for"; name: string; iterable: Expr; body: Node[] }
    | { kind: "set"; name: string; value: Expr }

interface IfNode {
    kind: "if"
    branches: Array<{ condition: Expr | null; body: Node[] }>
}

interface ForNode {
    kind: "for"
    name: string
    iterable: Expr
    body: Node[]
}

type Container =
    | { type: "root"; nodes: Node[] }
    | { type: "if"; node: IfNode }
    | { type: "for"; node: ForNode }

export function parseTemplate(source: string): Node[] {
    const root: Node[] = []
    const stack: Container[] = [{ type: "root", nodes: root }]
    let position = 0
    while (position < source.length) {
        const tag = nextTag(source, position)
        if (!tag) {
            append(stack, { kind: "text", value: source.slice(position) })
            break
        }
        if (tag.start > position) {
            append(stack, { kind: "text", value: source.slice(position, tag.start) })
        }
        position = tag.end
        if (tag.type === "prompt") {
            append(stack, {
                kind: "prompt",
                text: tag.inner,
                raw: source.slice(tag.start, tag.end),
            })
            continue
        }
        if (tag.type === "expr") {
            const inner = tag.inner.trim()
            const raw = source.slice(tag.start, tag.end)
            if (inner.startsWith("selector:")) {
                append(stack, { kind: "expr", expr: parseSelector(inner), raw })
            } else {
                append(stack, { kind: "expr", expr: parseExpression(inner), raw })
            }
            continue
        }
        handleStatement(tag.inner, stack)
    }
    return root
}

function append(stack: Container[], node: Node): void {
    const top = stack[stack.length - 1]
    if (!top) return
    if (top.type === "root") {
        top.nodes.push(node)
    } else if (top.type === "if") {
        const branch = top.node.branches[top.node.branches.length - 1]
        if (branch) branch.body.push(node)
    } else {
        top.node.body.push(node)
    }
}

interface Tag {
    type: "expr" | "stmt" | "prompt"
    inner: string
    start: number
    end: number
}

function nextTag(source: string, from: number): Tag | null {
    let index = from
    while (index < source.length) {
        const brace = source.indexOf("{", index)
        if (brace === -1) return null
        const rest = source.slice(brace, brace + 2)
        if (rest === "{{" || rest === "{%") {
            const closer = rest === "{{" ? "}}" : "%}"
            const close = source.indexOf(closer, brace + 2)
            if (close === -1) {
                return {
                    type: rest === "{{" ? "expr" : "stmt",
                    inner: source.slice(brace + 2),
                    start: brace,
                    end: source.length,
                }
            }
            return {
                type: rest === "{{" ? "expr" : "stmt",
                inner: source.slice(brace + 2, close),
                start: brace,
                end: close + 2,
            }
        }
        if (source[brace + 1] === '"') {
            const match = /^\{"((?:[^"\\]|\\.)*)"\s*\}/.exec(source.slice(brace))
            if (match) {
                return {
                    type: "prompt",
                    inner: unescapeString(match[1] ?? ""),
                    start: brace,
                    end: brace + match[0].length,
                }
            }
        }
        if (source[brace + 1] === "'") {
            const match = /^\{'((?:[^'\\]|\\.)*)'\s*\}/.exec(source.slice(brace))
            if (match) {
                return {
                    type: "prompt",
                    inner: unescapeString(match[1] ?? ""),
                    start: brace,
                    end: brace + match[0].length,
                }
            }
        }
        index = brace + 1
    }
    return null
}

function handleStatement(inner: string, stack: Container[]): void {
    const match = /^\s*(\w+)\s*([\s\S]*)$/.exec(inner)
    if (!match) {
        append(stack, { kind: "text", value: `{%${inner}%}` })
        return
    }
    const keyword = match[1] ?? ""
    const rest = match[2] ?? ""
    if (keyword === "if") {
        const node: IfNode = {
            kind: "if",
            branches: [{ condition: parseExpression(rest), body: [] }],
        }
        append(stack, node)
        stack.push({ type: "if", node })
        return
    }
    if (keyword === "elseif") {
        const top = stack[stack.length - 1]
        if (top?.type === "if") {
            top.node.branches.push({ condition: parseExpression(rest), body: [] })
        } else {
            append(stack, { kind: "text", value: `{%${inner}%}` })
        }
        return
    }
    if (keyword === "else") {
        const top = stack[stack.length - 1]
        if (top?.type === "if") {
            top.node.branches.push({ condition: null, body: [] })
        } else {
            append(stack, { kind: "text", value: `{%${inner}%}` })
        }
        return
    }
    if (keyword === "endif") {
        if (stack[stack.length - 1]?.type === "if") stack.pop()
        return
    }
    if (keyword === "for") {
        const forMatch = /^(\w+)\s+in\s+([\s\S]+)$/.exec(rest)
        if (!forMatch) {
            append(stack, { kind: "text", value: `{%${inner}%}` })
            return
        }
        const node: ForNode = {
            kind: "for",
            name: forMatch[1] ?? "",
            iterable: parseExpression(forMatch[2] ?? ""),
            body: [],
        }
        append(stack, node)
        stack.push({ type: "for", node })
        return
    }
    if (keyword === "endfor") {
        if (stack[stack.length - 1]?.type === "for") stack.pop()
        return
    }
    if (keyword === "set") {
        const setMatch = /^(\w+)\s*=\s*([\s\S]+)$/.exec(rest)
        if (setMatch) {
            append(stack, {
                kind: "set",
                name: setMatch[1] ?? "",
                value: parseExpression(setMatch[2] ?? ""),
            })
            return
        }
    }
    append(stack, { kind: "text", value: `{%${inner}%}` })
}

function parseSelector(inner: string): Expr {
    const raw = inner.slice("selector:".length).trim()
    const question = raw.indexOf("?")
    const query = (question === -1 ? raw : raw.slice(0, question)).trim()
    const attr = question === -1 ? undefined : raw.slice(question + 1).trim() || undefined
    return { kind: "selector", query, attr }
}

type Tok =
    | { type: "num"; value: number }
    | { type: "str"; value: string }
    | { type: "ident"; value: string }
    | { type: "punc"; value: string }

const PUNCTUATION = [
    "&&",
    "||",
    "==",
    "!=",
    "<=",
    ">=",
    "??",
    ".",
    "[",
    "]",
    "(",
    ")",
    "|",
    "!",
    "<",
    ">",
    ":",
    ",",
]

function tokenize(input: string): Tok[] {
    const tokens: Tok[] = []
    let position = 0
    while (position < input.length) {
        const char = input[position]
        if (char === undefined) break
        if (/\s/.test(char)) {
            position++
            continue
        }
        if (char === '"' || char === "'") {
            const { value, length } = readString(input, position)
            tokens.push({ type: "str", value })
            position += length
            continue
        }
        const numberMatch = /^\d+(?:\.\d+)?/.exec(input.slice(position))
        if (numberMatch) {
            tokens.push({ type: "num", value: Number(numberMatch[0]) })
            position += numberMatch[0].length
            continue
        }
        const identMatch = /^[a-zA-Z_$][\w$]*/.exec(input.slice(position))
        if (identMatch) {
            tokens.push({ type: "ident", value: identMatch[0] })
            position += identMatch[0].length
            continue
        }
        const punc = PUNCTUATION.find((candidate) => input.startsWith(candidate, position))
        if (punc) {
            tokens.push({ type: "punc", value: punc })
            position += punc.length
            continue
        }
        position++
    }
    return tokens
}

function readString(input: string, start: number): { value: string; length: number } {
    const quote = input[start]
    let raw = ""
    let position = start + 1
    while (position < input.length && input[position] !== quote) {
        if (input[position] === "\\" && position + 1 < input.length) {
            raw += input.slice(position, position + 2)
            position += 2
        } else {
            raw += input[position]
            position++
        }
    }
    const value = JSON.parse(`"${raw.replace(/\\'/g, "'")}"`) as string
    return { value, length: position - start + 1 }
}

class ExprParser {
    private tokens: Tok[]
    private position = 0

    constructor(tokens: Tok[]) {
        this.tokens = tokens
    }

    static parse(input: string): Expr {
        return new ExprParser(tokenize(input)).parseNullish()
    }

    private peek(): Tok | undefined {
        return this.tokens[this.position]
    }

    private matchPunc(value: string): boolean {
        const token = this.peek()
        if (token && token.type === "punc" && token.value === value) {
            this.position++
            return true
        }
        return false
    }

    private matchKeyword(word: string): boolean {
        const token = this.peek()
        if (token && token.type === "ident" && token.value === word) {
            this.position++
            return true
        }
        return false
    }

    private parseNullish(): Expr {
        let left = this.parseOr()
        while (this.matchPunc("??")) {
            left = { kind: "binary", op: "??", left, right: this.parseOr() }
        }
        return left
    }

    private parseOr(): Expr {
        let left = this.parseAnd()
        while (this.matchPunc("||")) {
            left = { kind: "binary", op: "||", left, right: this.parseAnd() }
        }
        return left
    }

    private parseAnd(): Expr {
        let left = this.parseEquality()
        while (this.matchPunc("&&")) {
            left = { kind: "binary", op: "&&", left, right: this.parseEquality() }
        }
        return left
    }

    private parseEquality(): Expr {
        let left = this.parseComparison()
        for (;;) {
            if (this.matchPunc("==")) {
                left = { kind: "binary", op: "==", left, right: this.parseComparison() }
            } else if (this.matchPunc("!=")) {
                left = { kind: "binary", op: "!=", left, right: this.parseComparison() }
            } else {
                return left
            }
        }
    }

    private parseComparison(): Expr {
        let left = this.parseUnary()
        for (;;) {
            if (this.matchPunc("<")) {
                left = { kind: "binary", op: "<", left, right: this.parseUnary() }
            } else if (this.matchPunc(">")) {
                left = { kind: "binary", op: ">", left, right: this.parseUnary() }
            } else if (this.matchPunc("<=")) {
                left = { kind: "binary", op: "<=", left, right: this.parseUnary() }
            } else if (this.matchPunc(">=")) {
                left = { kind: "binary", op: ">=", left, right: this.parseUnary() }
            } else if (this.matchKeyword("contains")) {
                left = { kind: "binary", op: "contains", left, right: this.parseUnary() }
            } else {
                return left
            }
        }
    }

    private parseUnary(): Expr {
        if (this.matchPunc("!")) {
            return { kind: "unary", op: "!", operand: this.parseUnary() }
        }
        return this.parsePostfix()
    }

    private parsePostfix(): Expr {
        let expr = this.parsePrimary()
        for (;;) {
            const token = this.peek()
            if (!token) return expr
            if (token.type === "punc" && token.value === "." && expr.kind === "variable") {
                this.position++
                const next = this.peek()
                if (next?.type === "ident") {
                    this.position++
                    expr = { kind: "variable", path: [...expr.path, next.value] }
                    continue
                }
                return expr
            }
            if (token.type === "punc" && token.value === "[" && expr.kind === "variable") {
                this.position++
                const index = this.parseNullish()
                this.matchPunc("]")
                expr = { kind: "variable", path: [...expr.path, { index }] }
                continue
            }
            if (token.type === "punc" && token.value === "|") {
                this.position++
                const name = this.peek()
                if (name?.type !== "ident") return expr
                this.position++
                let arg: Expr | undefined
                if (this.matchPunc(":")) {
                    arg = this.parsePipeArg()
                    if (this.matchPunc(",")) {
                        const items = [arg]
                        for (;;) {
                            items.push(this.parsePipeArg())
                            if (!this.matchPunc(",")) break
                        }
                        arg = { kind: "list", items }
                    }
                }
                expr = { kind: "pipe", operand: expr, name: name.value, arg }
                continue
            }
            return expr
        }
    }

    private parsePipeArg(): Expr {
        const token = this.peek()
        if (token?.type === "str" || token?.type === "num") {
            this.position++
            return { kind: "literal", value: token.value }
        }
        if (token?.type === "ident") {
            this.position++
            return { kind: "variable", path: [token.value] }
        }
        return { kind: "literal", value: null }
    }

    private parsePrimary(): Expr {
        const token = this.peek()
        if (!token) return { kind: "literal", value: null }
        if (token.type === "num") {
            this.position++
            return { kind: "literal", value: token.value }
        }
        if (token.type === "str") {
            this.position++
            return { kind: "literal", value: token.value }
        }
        if (token.type === "ident") {
            this.position++
            if (token.value === "true") return { kind: "literal", value: true }
            if (token.value === "false") return { kind: "literal", value: false }
            if (token.value === "null") return { kind: "literal", value: null }
            return { kind: "variable", path: [token.value] }
        }
        if (token.type === "punc" && token.value === "(") {
            this.position++
            const expr = this.parseNullish()
            this.matchPunc(")")
            return expr
        }
        this.position++
        return { kind: "literal", value: null }
    }
}

export function parseExpression(input: string): Expr {
    return ExprParser.parse(input)
}

function unescapeString(value: string): string {
    return value.replace(/\\(["'\\])/g, "$1")
}
