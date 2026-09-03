import { el } from "../../lib/dom"
import { READER_FONTS, readerStyleVars, resolveTheme } from "../../lib/settings-schema"
import type { PageContext } from "../state"
import { fieldRow, pageSection, selectInput, toggleInput } from "../ui"

const SAMPLE_ARTICLE = `
<h1>Reading, distraction-free</h1>
<p>
    This is how clipped articles will look in the reader view. Adjust the font, size and
    line height until it feels right — the preview updates as you type.
</p>
<p>
    Links can keep their color, or blend into the text like a book:
    <a href="#" onclick="return false">this is a link</a>.
</p>
<blockquote>Highlights and quotes sit inside blockquotes.</blockquote>
<pre><code>code blocks stay monospaced</code></pre>
`

export function renderReader(ctx: PageContext): HTMLElement {
    const container = document.createElement("div")
    const theme = resolveTheme(ctx.state.settings)

    const preview = document.createElement("div")
    preview.className = "reader-preview"
    preview.dataset.datalithTheme = theme.id
    const article = document.createElement("div")
    article.className = "reader-preview-article"
    article.innerHTML = SAMPLE_ARTICLE
    preview.append(article)
    const applyPreview = () => {
        for (const [name, value] of Object.entries(readerStyleVars(ctx.state.settings))) {
            preview.style.setProperty(name, value)
        }
    }
    applyPreview()

    const reader = ctx.state.settings.reader
    const update = (apply: () => void) => {
        apply()
        ctx.save()
        applyPreview()
    }

    const sizeValue = document.createElement("span")
    sizeValue.className = "slider-value"
    const lineHeightValue = document.createElement("span")
    lineHeightValue.className = "slider-value"

    const sizeSlider = document.createElement("input")
    sizeSlider.type = "range"
    sizeSlider.min = "12"
    sizeSlider.max = "24"
    sizeSlider.step = "1"
    sizeSlider.value = String(reader.fontSize)
    const syncSize = () => {
        sizeValue.textContent = `${reader.fontSize}px`
    }
    sizeSlider.addEventListener("input", () =>
        update(() => {
            reader.fontSize = Number(sizeSlider.value)
            syncSize()
        }),
    )

    const lineHeightSlider = document.createElement("input")
    lineHeightSlider.type = "range"
    lineHeightSlider.min = "1.2"
    lineHeightSlider.max = "2.4"
    lineHeightSlider.step = "0.1"
    lineHeightSlider.value = String(reader.lineHeight)
    const syncLineHeight = () => {
        lineHeightValue.textContent = reader.lineHeight.toFixed(1)
    }
    lineHeightSlider.addEventListener("input", () =>
        update(() => {
            reader.lineHeight = Number(lineHeightSlider.value)
            syncLineHeight()
        }),
    )

    const fontSelect = selectInput(
        READER_FONTS.map((font) => ({ value: font.stack, label: font.label })),
        reader.font,
        (stack) => update(() => (reader.font = stack)),
    )
    const colorLinks = toggleInput(reader.colorLinks, (value) =>
        update(() => (reader.colorLinks = value)),
    )

    container.append(
        pageSection("Preview", [preview]),
        pageSection("Font", [
            fieldRow("Font", fontSelect),
            fieldRow("Size", el("span", { className: "slider-row" }, [sizeSlider, sizeValue])),
            fieldRow(
                "Line height",
                el("span", { className: "slider-row" }, [lineHeightSlider, lineHeightValue]),
            ),
            fieldRow("Color links", colorLinks),
        ]),
    )
    syncSize()
    syncLineHeight()
    return container
}
