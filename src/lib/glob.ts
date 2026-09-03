const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i

export function globToRegExp(pattern: string): RegExp {
    const escaped = pattern
        .trim()
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
    return new RegExp(`^${escaped}$`, "i")
}

export function matchGlob(url: string, pattern: string): boolean {
    const trimmed = pattern.trim()
    if (trimmed === "") return false
    const target = SCHEME_PATTERN.test(trimmed) ? url : url.replace(SCHEME_PATTERN, "")
    return globToRegExp(trimmed).test(target)
}

export function matchAnyGlob(url: string, patterns: string): boolean {
    return patterns.split("\n").some((line) => matchGlob(url, line))
}
