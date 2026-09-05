import { describe, expect, it } from "vitest"

import { renderTemplate } from "../../src/lib/template"

const SELECTOR_MAP: Record<string, string[]> = {
    h1: ["First Heading", "Second Heading"],
    "img.hero?src": ["/hero-a.png", "/hero-b.png"],
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
            name: "bare list joins with blank lines",
            template: "{{items}}",
            variables: { items: ["one", "two"] },
            expected: "one\n\ntwo",
        },
        {
            name: "selector with resolver",
            template: "{{selector:h1}}",
            expected: "First Heading\n\nSecond Heading",
        },
        {
            name: "selector attribute query",
            template: "{{selector:img.hero?src}}",
            expected: "/hero-a.png\n\n/hero-b.png",
        },
        {
            name: "prompt renders unchanged without interpreter",
            template: 'Before {"Summarize this page"} after',
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
            name: "fallback with ??",
            template: "{{ author ?? 'Unknown' }}",
            variables: { author: "" },
            expected: "Unknown",
        },
        {
            name: "fallback keeps existing value",
            template: "{{ author ?? 'Unknown' }}",
            variables: { author: "Ada" },
            expected: "Ada",
        },
        {
            name: "or keeps first truthy value",
            template: "{{ a || b }}",
            variables: { a: "", b: "b" },
            expected: "b",
        },
        {
            name: "for loop with loop.index",
            template: "{% for item in items %}{{loop.index}}:{{item}};{% endfor %}",
            variables: { items: ["a", "b"] },
            expected: "1:a;2:b;",
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
            name: "merge pipe on string and list",
            template: "{{ title|merge:'!' }} {{ tags|merge:'c'|join:'-' }}",
            variables: { title: "Hi", tags: ["a", "b"] },
            expected: "Hi! a-b-c",
        },
        {
            name: "nth pipe keeps first n elements",
            template: "{{ tags|nth:2|join:',' }} {{ title|nth:3 }}",
            variables: { tags: ["a", "b", "c"], title: "Rust" },
            expected: "a,b Rus",
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
            name: "date_modify on datetime values",
            template: "{{ date|date_modify:'+3 hours' }}",
            variables: { date: "2026-01-01T10:00:00.000Z" },
            expected: "2026-01-01T13:00:00.000Z",
        },
        {
            name: "pipes chain left to right",
            template: "{{ title|length|calc:'-2' }}",
            variables: { title: "Hello" },
            expected: "3",
        },
        {
            name: "unknown pipe leaves value unchanged",
            template: "{{ title|nope }}",
            variables: { title: "Hi" },
            expected: "Hi",
        },
        {
            name: "plain braces stay literal",
            template: "a { b } c {not a tag",
            expected: "a { b } c {not a tag",
        },
        {
            name: "default template shape",
            template:
                "{% if image %}![[{{image}}]]{% endif %}\n{{selection}}\n{{highlights}}\n{% if image || selection || highlights %}---{% endif %}\n{{content}}",
            variables: { image: "", selection: "", highlights: [], content: "Body text" },
            expected: "\n\n\n\nBody text",
        },
    ]

    for (const testCase of cases) {
        it(testCase.name, async () => {
            const result = await renderTemplate(testCase.template, {
                variables: testCase.variables ?? {},
                resolveSelector: (query, attr) => {
                    const key = `${query}${attr ? `?${attr}` : ""}`
                    return SELECTOR_MAP[key] ?? []
                },
            })
            expect(result).toBe(testCase.expected)
        })
    }

    it("renders prompts through the interpreter", async () => {
        const result = await renderTemplate("{{title}} — {'summarize'}", {
            variables: { title: "T" },
            interpreter: async (prompt) => `<${prompt.toUpperCase()}>`,
        })
        expect(result).toBe("T — <SUMMARIZE>")
    })

    it("keeps deferred variables in the source", async () => {
        const result = await renderTemplate("# {{title}}\n{{highlights}}\n", {
            variables: { title: "T", highlights: ["a"] },
            deferred: ["highlights"],
        })
        expect(result).toBe("# T\n{{highlights}}\n")
    })

    it("keeps deferred variables with pipes in the source", async () => {
        const result = await renderTemplate("{{highlights | trim}}!", {
            variables: { highlights: "  x  " },
            deferred: ["highlights"],
        })
        expect(result).toBe("{{highlights | trim}}!")
    })

    it("still evaluates deferred variables inside if conditions", async () => {
        const result = await renderTemplate("{% if highlights %}[{{highlights}}]{% endif %}", {
            variables: { highlights: ["a"] },
            deferred: ["highlights"],
        })
        expect(result).toBe("[{{highlights}}]")
    })

    it("resolves deferred variables once deferral is lifted", async () => {
        const result = await renderTemplate("{{highlights}}", {
            variables: { highlights: ["a", "b"] },
        })
        expect(result).toBe("a\n\nb")
    })

    it("keeps prompts in the source with keepPrompts", async () => {
        const result = await renderTemplate("A {'summarize this'} B", {
            variables: {},
            keepPrompts: true,
        })
        expect(result).toBe("A {'summarize this'} B")
    })

    it("keeps prompts while resolving other variables", async () => {
        const result = await renderTemplate("{{title}} {'summarize'}", {
            variables: { title: "T" },
            keepPrompts: true,
        })
        expect(result).toBe("T {'summarize'}")
    })

    it("evaluates prompts through the interpreter when not kept", async () => {
        const result = await renderTemplate("{'summarize'}", {
            variables: {},
            interpreter: async (prompt) => `<${prompt.toUpperCase()}>`,
            keepPrompts: false,
        })
        expect(result).toBe("<SUMMARIZE>")
    })
})
