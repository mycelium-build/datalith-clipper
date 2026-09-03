export interface TemplateProperty {
    name: string
    value: string
}

export interface Template {
    id: string
    name: string
    trigger: string
    noteName: string
    noteFolder: string
    vault: string
    properties: TemplateProperty[]
    content: string
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
        "{% if image %}![[{{image}}]]{% endif %}\n" +
        "{{selection}}\n" +
        "{{highlights}}\n" +
        "{% if image || selection || highlights %}---{% endif %}\n" +
        "{{content}}",
}

export const DEFAULT_TEMPLATES: Template[] = [DEFAULT_TEMPLATE]
