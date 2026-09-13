import { describe, expect, it } from "vitest"

import {
    renderTemplate,
    templateErrorMessage,
    validateTemplate,
    type RenderOptions,
} from "../../src/lib/template"

const SELECTOR_MAP: Record<string, string[]> = {
    h1: ["First Heading", "Second Heading"],
    "img.hero?src": ["/hero-a.png", "/hero-b.png"],
    p: ["Only paragraph"],
    empty: [],
}

async function render(template: string, options: Partial<RenderOptions> = {}): Promise<string> {
    return renderTemplate(template, {
        variables: {},
        resolveSelector: (query, attr) => {
            const key = `${query}${attr ? `?${attr}` : ""}`
            return SELECTOR_MAP[key] ?? []
        },
        ...options,
    })
}

describe("renderTemplate", () => {
    const cases: Array<{
        name: string
        template: string
        variables?: Record<string, unknown>
        expected: string
    }> = [
        {
            name: "interpolates a variable",
            template: "Hello {{name}}!",
            variables: { name: "World" },
            expected: "Hello World!",
        },
        {
            name: "unknown variables render empty",
            template: "a{{missing}}b",
            expected: "ab",
        },
        {
            name: "list indexing",
            template: "{{items[0]}} / {{items[2]}}",
            variables: { items: ["a", "b", "c"] },
            expected: "a / c",
        },
        {
            name: "out-of-range index renders empty",
            template: "[{{items[9]}}]",
            variables: { items: ["a"] },
            expected: "[]",
        },
        {
            name: "nested property access",
            template: "{{meta.author.name}}",
            variables: { meta: { author: { name: "Ada" } } },
            expected: "Ada",
        },
        {
            name: "missing nested property renders empty",
            template: "{{meta.author.missing}}x",
            variables: { meta: {} },
            expected: "x",
        },
        {
            name: "bare list renders as JSON",
            template: "{{items}}",
            variables: { items: ["one", "two"] },
            expected: '["one","two"]',
        },
        {
            name: "selector with resolver renders the collection",
            template: "{{selector:h1 | join:', '}}",
            expected: "First Heading, Second Heading",
        },
        {
            name: "selector attribute query",
            template: "{{selector:img.hero?src | join:', '}}",
            expected: "/hero-a.png, /hero-b.png",
        },
        {
            name: "single selector match renders as a plain string",
            template: "[{{selector:p}}]",
            expected: "[Only paragraph]",
        },
        {
            name: "empty selector renders empty",
            template: "[{{selector:empty}}]",
            expected: "[]",
        },
        {
            name: "prompt renders as plain text without interpreter",
            template: 'Before {{"Summarize this page"}} after',
            expected: "Before Summarize this page after",
        },
        {
            name: "if renders body when truthy",
            template: "{% if image %}![[{{image}}]]{% endif %}",
            variables: { image: "pic.png" },
            expected: "![[pic.png]]",
        },
        {
            name: "if renders nothing when empty",
            template: "{% if image %}Y{% endif %}",
            variables: { image: "" },
            expected: "",
        },
        {
            name: "empty list is falsy",
            template: "{% if highlights %}H{% endif %}",
            variables: { highlights: [] },
            expected: "",
        },
        {
            name: "zero is falsy",
            template: "{% if count %}C{% endif %}",
            variables: { count: 0 },
            expected: "",
        },
        {
            name: "if / else",
            template: "{% if a %}A{% else %}B{% endif %}",
            variables: { a: "" },
            expected: "B",
        },
        {
            name: "if / elseif / else",
            template: "{% if a == 1 %}one{% elseif a == 2 %}two{% else %}many{% endif %}",
            variables: { a: 2 },
            expected: "two",
        },
        {
            name: "equality across number and string",
            template: "{{ n == '10' }} {{ n != 11 }}",
            variables: { n: 10 },
            expected: "true true",
        },
        {
            name: "comparisons",
            template: "{{ a < 10 }} {{ a > 10 }} {{ a <= 10 }} {{ a >= 11 }}",
            variables: { a: 10 },
            expected: "false false true false",
        },
        {
            name: "contains for strings",
            template: "{% if title contains 'Rust' %}Y{% endif %}",
            variables: { title: "The Rust Book" },
            expected: "Y",
        },
        {
            name: "contains for lists",
            template: "{{ tags contains 'x' }}",
            variables: { tags: ["a", "x"] },
            expected: "true",
        },
        {
            name: "logic operators with parentheses",
            template: "{% if (a < 10 || a > 100) && b == 10 %}ok{% endif %}",
            variables: { a: 5, b: 10 },
            expected: "ok",
        },
        {
            name: "negation",
            template: "{% if !a %}empty{% endif %}",
            variables: { a: "" },
            expected: "empty",
        },
        {
            name: "nullish ?? falls back on empty string",
            template: '{{ author ?? "Unknown" }}',
            variables: { author: "" },
            expected: "Unknown",
        },
        {
            name: "nullish ?? keeps an existing value",
            template: '{{ author ?? "Unknown" }}',
            variables: { author: "Ada" },
            expected: "Ada",
        },
        {
            name: "nullish ?? falls back on zero",
            template: '{{ n ?? "Unknown" }}',
            variables: { n: 0 },
            expected: "Unknown",
        },
        {
            name: "or renders a boolean, not the operand",
            template: "{{ a || b }}",
            variables: { a: "", b: "b" },
            expected: "true",
        },
        {
            name: "for loop with loop.index",
            template: "{% for item in items %}{{loop.index}}:{{item}};{% endfor %}",
            variables: { items: ["a", "b"] },
            expected: "1:a;\n2:b;",
        },
        {
            name: "for over missing renders nothing",
            template: "[{% for item in missing %}x{% endfor %}]",
            expected: "[]",
        },
        {
            name: "set stores a value",
            template: "{% set name = author %}Hi {{name}}",
            variables: { author: "Ada" },
            expected: "Hi Ada",
        },
        {
            name: "calc pipe",
            template:
                "{{ n|calc:'+10' }} {{ n|calc:'-2' }} {{ n|calc:'*3' }} {{ n|calc:'/2' }} {{ n|calc:'^2' }}",
            variables: { n: 4 },
            expected: "14 2 12 2 16",
        },
        {
            name: "length pipe",
            template: "{{ title|length }} {{ tags|length }}",
            variables: { title: "Hello", tags: [1, 2, 3] },
            expected: "5 3",
        },
        {
            name: "round pipes",
            template: "{{ n|round }} {{ n|round:2 }}",
            variables: { n: 3.14159 },
            expected: "3 3.14",
        },
        {
            name: "join pipe",
            template: "{{ tags|join:', ' }}",
            variables: { tags: ["a", "b"] },
            expected: "a, b",
        },
        {
            name: "merge appends to a list",
            template: "{{ tags|merge:'c'|join:'-' }}",
            variables: { tags: ["a", "b"] },
            expected: "a-b-c",
        },
        {
            name: "merge on a string produces a list",
            template: "{{ title|merge:'!' }}",
            variables: { title: "Hi" },
            expected: '["Hi","!"]',
        },
        {
            name: "nth pipe selects every nth element",
            template: "{{ tags|nth:2|join:',' }} {{ tags|slice:0,2|join:',' }}",
            variables: { tags: ["a", "b", "c"] },
            expected: "b a,b",
        },
        {
            name: "reverse pipe",
            template: "{{ title|reverse }} {{ tags|reverse|join:'-' }}",
            variables: { title: "abc", tags: [1, 2] },
            expected: "cba 2-1",
        },
        {
            name: "slice pipe with two arguments",
            template: "{{ tags|slice:1,3|join:',' }} {{ title|slice:0,2 }}",
            variables: { tags: ["a", "b", "c", "d"], title: "Rust" },
            expected: "b,c Ru",
        },
        {
            name: "split and unique pipes",
            template: "{{ csv|split:','|join:'|' }} {{ tags|unique|join:',' }}",
            variables: { csv: "a,b,c", tags: ["a", "b", "a", "c"] },
            expected: "a|b|c a,b,c",
        },
        {
            name: "date_modify on date-only values",
            template: "{{ date|date_modify:'+1 day' }} {{ date|date_modify:'-2 weeks' }}",
            variables: { date: "2026-01-01" },
            expected: "2026-01-02 2025-12-18",
        },
        {
            name: "date_modify on a full ISO datetime drops the time part",
            template: "{{ date|date_modify:'+3 hours' }}",
            variables: { date: "2026-01-01T10:00:00.000Z" },
            expected: "2026-01-01",
        },
        {
            name: "pipes chain left to right",
            template: "{{ title|length|calc:'-2' }}",
            variables: { title: "Hello" },
            expected: "3",
        },
        {
            name: "plain braces stay literal",
            template: "a { b } c {not a tag",
            expected: "a { b } c {not a tag",
        },
    ]

    for (const testCase of cases) {
        it(testCase.name, async () => {
            const result = await render(testCase.template, {
                variables: testCase.variables ?? {},
            })
            expect(result).toBe(testCase.expected)
        })
    }

    it("throws on unknown filters", async () => {
        await expect(render("{{ title|nope }}", { variables: { title: "Hi" } })).rejects.toThrow(
            'Unknown filter "nope"',
        )
    })

    it("throws on parse errors", async () => {
        await expect(render("Hello {{ title")).rejects.toThrow("Missing closing }}")
    })

    it("formats template errors with location", () => {
        expect(templateErrorMessage(new Error("plain"))).toBe("plain")
        const errors = validateTemplate("{{ title|nope }}")
        expect(templateErrorMessage({ errors })).toBe('Unknown filter "nope" (line 1, column 10)')
    })

    it("validates known filters", () => {
        expect(validateTemplate("{{ title | upper }}")).toEqual([])
        expect(validateTemplate("{{ title | nope }}")).toHaveLength(1)
    })

    it("renders prompts through the interpreter", async () => {
        const result = await render("{{title}} — {{'summarize'}}", {
            variables: { title: "T" },
            interpreter: async (prompt) => `<${prompt.toUpperCase()}>`,
        })
        expect(result).toBe("T — <SUMMARIZE>")
    })

    it("applies filters to interpreter output on save", async () => {
        const result = await render('{{"summarize" | upper | merge:"!" }}', {
            interpreter: async (prompt) => prompt,
        })
        expect(result).toBe('["SUMMARIZE","!"]')
    })

    it("keeps deferred variables in the source", async () => {
        const result = await render("# {{title}}\n{{highlights}}\n", {
            variables: { title: "T", highlights: ["a"] },
            deferred: ["highlights"],
        })
        expect(result).toBe("# T\n{{highlights}}\n")
    })

    it("keeps deferred variables with pipes in the source", async () => {
        const result = await render("{{highlights | trim}}!", {
            variables: { highlights: "  x  " },
            deferred: ["highlights"],
        })
        expect(result).toBe("{{highlights | trim}}!")
    })

    it("still evaluates deferred variables inside if conditions", async () => {
        const result = await render("{% if highlights %}[{{highlights}}]{% endif %}", {
            variables: { highlights: ["a"] },
            deferred: ["highlights"],
        })
        expect(result).toBe("[{{highlights}}]")
    })

    it("resolves deferred variables once deferral is lifted", async () => {
        const result = await render("{{highlights | join:'\\n\\n'}}", {
            variables: { highlights: ["a", "b"] },
        })
        expect(result).toBe("a\n\nb")
    })

    it("keeps prompts in the source with keepPrompts", async () => {
        const result = await render('A {{"summarize this"}} B', {
            keepPrompts: true,
        })
        expect(result).toBe('A {{"summarize this"}} B')
    })

    it("keeps prompts while resolving other variables", async () => {
        const result = await render('{{title}} {{"summarize"}}', {
            variables: { title: "T" },
            keepPrompts: true,
        })
        expect(result).toBe('T {{"summarize"}}')
    })

    it("evaluates prompts through the interpreter when not kept", async () => {
        const result = await render('{{"summarize"}}', {
            interpreter: async (prompt) => `<${prompt.toUpperCase()}>`,
        })
        expect(result).toBe("<SUMMARIZE>")
    })
})
