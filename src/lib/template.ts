import { applyFiltersWithRegistry, createEngine, standardFilters, type TemplateError } from "knap"

export interface RenderOptions {
    variables: Record<string, unknown>
    resolveSelector?: (query: string, attr?: string) => string[]
    interpreter?: (prompt: string) => Promise<string>
    /** Variable names whose interpolations stay in the source, unresolved. */
    deferred?: string[]
    /** Prompt expressions stay in the source instead of rendering. */
    keepPrompts?: boolean
}

const engine = createEngine({ filters: standardFilters })

const SENTINEL_OPEN = "\uE000"
const SENTINEL_CLOSE = "\uE001"

interface PromptSpan {
    raw: string
    prompt: string
    filters: string
}

/** Validate a template without data; errors carry code, line and column. */
export function validateTemplate(source: string): TemplateError[] {
    return engine.validate(source)
}

export async function renderTemplate(source: string, options: RenderOptions): Promise<string> {
    const variables: Record<string, unknown> = { ...options.variables }
    const prompts = new Map<string, { prompt: string; filters: string }>()

    let template = source
    if (options.keepPrompts) {
        template = deferPrompts(template, (span) => {
            const key = nextKey(variables, "__deferred_prompt")
            variables[key] = span.raw
            return `{{${key}}}`
        })
    } else if (options.interpreter) {
        template = deferPrompts(template, ({ prompt, filters }) => {
            const token = `${SENTINEL_OPEN}p${prompts.size}${SENTINEL_CLOSE}`
            prompts.set(token, { prompt, filters })
            return token
        })
    }
    if (options.deferred && options.deferred.length > 0) {
        const names = new Set(options.deferred)
        template = deferVariables(template, names, (raw, root) => {
            const key = nextKey(variables, `__deferred_${root}`)
            variables[key] = raw
            return `{{${key}}}`
        })
    }

    let output = await engine.renderOrThrow(template, {
        variables,
        resolveVariable: async (name) => {
            if (!name.startsWith("selector:")) return undefined
            if (!options.resolveSelector) return undefined
            const { query, attr } = parseSelector(name.slice("selector:".length))
            const values = options.resolveSelector(query, attr)
            if (values.length === 0) return undefined
            return values.length === 1 ? (values[0] ?? undefined) : values
        },
    })

    const resolved = await Promise.all(
        Array.from(prompts, async ([token, { prompt, filters }]) => {
            let value = await (options.interpreter?.(prompt) ?? prompt)
            if (filters !== "") {
                value = applyFiltersWithRegistry(value, filters, engine.filters, { variables })
            }
            return [token, value] as const
        }),
    )
    for (const [token, value] of resolved) {
        output = output.split(token).join(value)
    }
    return output
}

/** Replace every `{{"prompt"…}}` span with the replacer's substitution. */
function deferPrompts(source: string, replace: (span: PromptSpan) => string): string {
    let result = ""
    let position = 0
    for (;;) {
        const span = findExpression(source, position)
        if (!span) {
            result += source.slice(position)
            return result
        }
        const parsed = parsePrompt(span.inner)
        if (!parsed) {
            result += source.slice(position, span.end)
            position = span.end
            continue
        }
        result += source.slice(position, span.start) + replace(parsed)
        position = span.end
    }
}

interface ExpressionSpan {
    start: number
    end: number
    inner: string
}

function findExpression(source: string, from: number): ExpressionSpan | null {
    let index = source.indexOf("{{", from)
    while (index !== -1) {
        let cursor = index + 2
        let quote: string | null = null
        while (cursor < source.length) {
            const char = source[cursor]
            if (quote) {
                if (char === "\\") cursor++
                else if (char === quote) quote = null
            } else if (char === '"' || char === "'") {
                quote = char
            } else if (char === "}" && source[cursor + 1] === "}") {
                return {
                    start: index,
                    end: cursor + 2,
                    inner: source.slice(index + 2, cursor),
                }
            }
            cursor++
        }
        index = source.indexOf("{{", index + 2)
    }
    return null
}

const PROMPT_PATTERN = /^(\s*)("((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')(\s*\|[\s\S]*)?$/

function parsePrompt(inner: string): PromptSpan | null {
    const match = PROMPT_PATTERN.exec(inner)
    if (!match) return null
    const quoted = match[2] ?? ""
    const prompt = unescapeString(quoted.slice(1, -1))
    return { raw: `{{${inner}}}`, prompt, filters: match[5] ?? "" }
}

/**
 * Replace variable expressions rooted at a deferred name
 * with a placeholder variable whose value is the original source text;
 * Knap renders values as literal data, so the expression survives into the output untouched.
 */
function deferVariables(
    source: string,
    names: Set<string>,
    replace: (raw: string, root: string) => string,
): string {
    let result = ""
    let position = 0
    for (;;) {
        const span = findExpression(source, position)
        if (!span) {
            result += source.slice(position)
            return result
        }
        const root = /^(\s*)([A-Za-z_$][A-Za-z0-9_$]*)/.exec(span.inner)
        if (!root || !names.has(root[2] ?? "")) {
            result += source.slice(position, span.end)
            position = span.end
            continue
        }
        result += source.slice(position, span.start)
        result += replace(`{{${span.inner}}}`, root[2] ?? "")
        position = span.end
    }
}

function nextKey(variables: Record<string, unknown>, base: string): string {
    let index = 0
    let key = `${base}_0`
    while (key in variables) {
        index++
        key = `${base}_${index}`
    }
    return key
}

function parseSelector(raw: string): { query: string; attr?: string } {
    const question = raw.indexOf("?")
    const query = (question === -1 ? raw : raw.slice(0, question)).trim()
    const attr = question === -1 ? undefined : raw.slice(question + 1).trim() || undefined
    return { query, attr }
}

function unescapeString(value: string): string {
    return value.replace(/\\(["'\\])/g, "$1")
}

export function templateErrorMessage(error: unknown): string {
    const errors = (error as { errors?: TemplateError[] }).errors
    if (Array.isArray(errors) && errors.length > 0) {
        return errors
            .map((entry) => `${entry.message} (line ${entry.line}, column ${entry.column})`)
            .join("; ")
    }
    return error instanceof Error ? error.message : String(error)
}
