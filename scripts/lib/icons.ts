export function camelCase(name: string): string {
    return name
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((part, index) =>
            index === 0
                ? part.toLowerCase()
                : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
        )
        .join("")
}
