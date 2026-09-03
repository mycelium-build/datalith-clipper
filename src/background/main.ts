import browser from "webextension-polyfill"

import { ClipperApi, type SaveNoteRequest } from "../lib/api"
import type { InterpreterConfig, InterpreterResponse } from "../lib/interpreter"
import { loadSettings } from "../lib/settings"
import { isCommandMessage, type SaveResponse, type VaultsResponse } from "../shared/messages"
import { completePrompt } from "./interpreter"
import { saveWithRetry } from "./save-pipeline"

async function sendToActiveTab(message: { type: string }): Promise<void> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (tab?.id === undefined) return
    try {
        await browser.tabs.sendMessage(tab.id, message)
    } catch {
        // No content script on this page (chrome://, store pages, …) — nothing to do.
    }
}

async function api(): Promise<ClipperApi> {
    const settings = await loadSettings()
    return new ClipperApi(settings.connection.baseUrl, settings.connection.token)
}

async function handleGetVaults(): Promise<VaultsResponse> {
    const result = await (await api()).vaults()
    return result.ok ? { ok: true, vaults: result.data } : { ok: false, error: result.error }
}

async function handleSaveClip(note: SaveNoteRequest): Promise<SaveResponse> {
    const settings = await loadSettings()
    const client = new ClipperApi(settings.connection.baseUrl, settings.connection.token)
    return saveWithRetry(note, {
        saveNote: (request) => client.saveNote(request),
        launch: async () => {
            await browser.tabs.create({ url: "datalith://launch", active: false })
        },
        openNote: async (path) => {
            await browser.tabs.create({
                url: `datalith://open?path=${encodeURIComponent(path)}`,
                active: true,
            })
        },
        shouldOpenNote: !settings.behavior.saveWithoutOpening,
    })
}

browser.action.onClicked.addListener((tab) => {
    if (tab.id !== undefined) {
        browser.tabs.sendMessage(tab.id, { type: "toggle-panel" }).catch(() => {
            // No content script on this page.
        })
    }
})

browser.commands.onCommand.addListener((command) => {
    if (command === "toggle-highlighter") {
        sendToActiveTab({ type: "toggle-highlighter" })
    } else if (command === "open-clipper") {
        sendToActiveTab({ type: "toggle-panel" })
    } else if (command === "toggle-reader") {
        sendToActiveTab({ type: "toggle-reader" })
    }
})

browser.runtime.onMessage.addListener((message: unknown) => {
    if (typeof message !== "object" || message === null) return undefined
    const type = (message as Record<string, unknown>).type
    if (type === "open-settings") {
        browser.runtime.openOptionsPage()
        return undefined
    }
    if (type === "get-vaults") {
        return handleGetVaults()
    }
    if (type === "save-clip") {
        const note = (message as { note?: SaveNoteRequest }).note
        return note
            ? handleSaveClip(note)
            : Promise.resolve({ ok: false, error: "Malformed save request" })
    }
    if (type === "interpreter-complete") {
        const request = message as { config?: InterpreterConfig; prompt?: string }
        if (!request.config || typeof request.prompt !== "string") {
            return Promise.resolve<InterpreterResponse>({
                ok: false,
                error: "Malformed interpreter request",
            })
        }
        return completePrompt(request.config, request.prompt)
    }
    if (isCommandMessage(message)) {
        // Commands from other extension contexts (options page shortcuts).
        return undefined
    }
    return undefined
})
