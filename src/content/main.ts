import browser from "webextension-polyfill"

import { isCommandMessage } from "../shared/messages"
import { Panel } from "./panel/panel"
import { toggleReader } from "./reader/reader"

const CONTENT_COMMANDS = new Set(["toggle-panel", "toggle-highlighter", "toggle-reader"])

let lastSelection = ""

document.addEventListener("selectionchange", () => {
    const selection = window.getSelection()?.toString().trim() ?? ""
    if (selection !== "") {
        lastSelection = selection
    }
})

browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isCommandMessage(message) || !CONTENT_COMMANDS.has(message.type)) return
    if (message.type === "toggle-panel") {
        Panel.toggle(lastSelection).catch(() => {
            // Panel errors are surfaced in its status line
        })
    } else if (message.type === "toggle-reader") {
        toggleReader()
    } else if (message.type === "toggle-highlighter") {
        if (Panel.current) {
            Panel.current.toggleHighlighter()
        } else {
            Panel.toggle(lastSelection, { enableHighlighter: true })
        }
    }
})
