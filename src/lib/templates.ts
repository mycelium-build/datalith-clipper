export interface Template {
    id: string
    name: string
    trigger: string
    noteName: string
    noteFolder: string
    vault: string
    properties: { name: string; value: string }[]
    content: string
    context: string
}

export const LAST_USED_VAULT = "Last used"

export const DEFAULT_TEMPLATE: Template = {
    id: "default",
    name: "Default",
    trigger: "",
    noteName: "{{title}}",
    noteFolder: "Clips",
    vault: LAST_USED_VAULT,
    properties: [
        { name: "title", value: "{{title}}" },
        { name: "source", value: "{{url}}" },
        { name: "author", value: "{{author}}" },
        { name: "created", value: "{{date}}" },
        { name: "description", value: "{{description}}" },
        { name: "image", value: "{{image}}" },
        { name: "tags", value: "clips" },
    ],
    content:
        '{{"short summary of the page, like 3 sentences, just output the summary"}}\n\n' +
        "{% if image %}![[{{image}}]]{% endif %}\n\n" +
        "{{selection}}\n\n" +
        "Highlights:\n\n{{highlights | join:'\\n\\n'}}\n\n" +
        "---\n\n" +
        "{{content}}",
    context: "",
}

export const DEFAULT_TEMPLATES: Template[] = [DEFAULT_TEMPLATE]

export function resolveTemplates(stored: Template[]): Template[] {
    return stored.length > 0 ? stored : DEFAULT_TEMPLATES
}

export function newTemplate(): Template {
    return {
        id: `template-${crypto.randomUUID?.() ?? Date.now().toString(36)}`,
        name: "New template",
        trigger: "",
        noteName: "{{title}}",
        noteFolder: "Clips",
        vault: LAST_USED_VAULT,
        properties: [],
        content: "{{content}}",
        context: "",
    }
}
