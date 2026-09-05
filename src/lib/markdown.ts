const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i

function escapeHtml(text: string): string {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

/**
 * Renders wikilink-style embeds for preview.
 * `![[image.png]]` becomes an image (direct URLs and image extensions),
 * other embeds become a placeholder chip.
 */
export function renderWikilinkEmbeds(markdown: string): string {
    return markdown.replace(/!\[\[([^\]|]*?)(?:\|([^\]]*))?\]\]/g, (_match, target, label) => {
        const source = String(target).trim()
        if (source === "") return _match
        const alt = String(label ?? "").trim() || source
        if (/^(https?:)?\/\//i.test(source) || IMAGE_EXTENSIONS.test(source)) {
            return `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}">`
        }
        return `<span class="wikilink-embed">${escapeHtml(source)}</span>`
    })
}
