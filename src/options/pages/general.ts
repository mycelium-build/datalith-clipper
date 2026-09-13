import browser from "webextension-polyfill"

import themesIndex from "../../data/themes.json"
import { el } from "../../lib/dom"
import {
    composeBaseUrl,
    isValidPort,
    PORT_MAX,
    PORT_MIN,
    splitBaseUrl,
} from "../../lib/settings-schema"
import type { VaultsResponse } from "../../shared/messages"
import { hasOriginPermission, requestOriginPermission } from "../permissions"
import type { PageContext } from "../state"
import { exportPayload, importSettings } from "../state"
import {
    actionButton,
    fieldRow,
    numberInput,
    pageSection,
    selectInput,
    textInput,
    toggleInput,
} from "../ui"

const CHANGELOG_URL = "https://github.com/mycelium-build/datalith-clipper/blob/main/CHANGELOG.md"

interface ThemeIndexEntry {
    id: string
    name: string
    mode: string
}

const HOTKEYS: Array<[string, string]> = [
    ["Toggle highlighter", "Alt+Shift+H"],
    ["Open Datalith Clipper", "Alt+Shift+O"],
    ["Toggle reader", "Alt+Shift+R"],
]

export function renderGeneral(ctx: PageContext): HTMLElement {
    const container = document.createElement("div")

    const version = browser.runtime.getManifest().version
    const changelog = document.createElement("a")
    changelog.href = CHANGELOG_URL
    changelog.target = "_blank"
    changelog.rel = "noreferrer"
    changelog.textContent = "Changelog"
    container.append(
        pageSection("Version", [
            fieldRow("Version", el("span", { text: `v${version}` })),
            fieldRow("What's new", changelog),
        ]),
    )

    const vaultSection = buildVaultSection()
    container.append(
        pageSection("Connection", [buildConnectionSection(ctx, vaultSection.reload)]),
        pageSection("Vaults", [vaultSection.root]),
    )

    const themeOptionsFor = (mode: string) =>
        (themesIndex as ThemeIndexEntry[])
            .filter((theme) => theme.mode === mode)
            .map((theme) => ({ value: theme.id, label: theme.name }))
    container.append(
        pageSection("Themes", [
            fieldRow(
                "Appearance",
                selectInput(
                    [
                        { value: "auto", label: "Auto" },
                        { value: "light", label: "Light" },
                        { value: "dark", label: "Dark" },
                    ],
                    ctx.state.settings.appearance.mode,
                    (mode) => {
                        ctx.state.settings.appearance.mode =
                            mode as typeof ctx.state.settings.appearance.mode
                        ctx.applyTheme()
                        ctx.save()
                    },
                ),
            ),
            fieldRow(
                "Light theme",
                selectInput(themeOptionsFor("light"), ctx.state.settings.appearance.light, (id) => {
                    ctx.state.settings.appearance.light = id
                    ctx.applyTheme()
                    ctx.save()
                }),
            ),
            fieldRow(
                "Dark theme",
                selectInput(themeOptionsFor("dark"), ctx.state.settings.appearance.dark, (id) => {
                    ctx.state.settings.appearance.dark = id
                    ctx.applyTheme()
                    ctx.save()
                }),
            ),
        ]),
    )

    container.append(
        pageSection(
            "Hotkeys",
            HOTKEYS.map(([label, keys]) =>
                fieldRow(label, el("kbd", { className: "hotkey", text: keys })),
            ),
        ),
    )

    container.append(
        pageSection("Behavior", [
            fieldRow(
                "Save clipped note without opening Datalith",
                toggleInput(ctx.state.settings.behavior.saveWithoutOpening, (value) => {
                    ctx.state.settings.behavior.saveWithoutOpening = value
                    ctx.save()
                }),
                "When off, the saved note is revealed in Datalith after every save.",
            ),
        ]),
    )

    container.append(pageSection("Export & import", [buildExportImport(ctx)]))
    return container
}

function buildVaultSection(): { root: HTMLElement; reload: () => void } {
    const select = document.createElement("select")
    select.className = "text-input vault-select"
    select.disabled = true
    select.append(new Option("Loading vaults…", ""))
    const sync = actionButton("Sync", () => void loadVaults(select))
    void loadVaults(select)
    return {
        root: el("div", { className: "field-row" }, [select, sync]),
        reload: () => void loadVaults(select),
    }
}

const CONNECTION_DEBOUNCE_MS = 500

function buildConnectionSection(ctx: PageContext, onConnectionChanged: () => void): HTMLElement {
    const connection = ctx.state.settings.connection
    const initial = splitBaseUrl(connection.baseUrl)

    let validPort = initial.port
    const apply = () => {
        if (isValidPort(portInput.value)) {
            validPort = portInput.value
        } else {
            portInput.value = validPort
        }
        const baseUrl = composeBaseUrl(urlInput.value, portInput.value)
        if (baseUrl !== null && baseUrl !== connection.baseUrl) connection.baseUrl = baseUrl
        connection.token = tokenInput.value.trim()
        void ctx.save()
        onConnectionChanged()
        void refreshAccess()
    }
    const scheduleApply = debounce(apply, CONNECTION_DEBOUNCE_MS)

    const accessStatus = el("span", { className: "field-description" })
    const accessButton = actionButton("Grant access", () => {
        const baseUrl = composeBaseUrl(urlInput.value, portInput.value)
        if (baseUrl === null) return
        void requestOriginPermission(baseUrl).then(() => void refreshAccess())
    })
    const refreshAccess = () => {
        const baseUrl = composeBaseUrl(urlInput.value, portInput.value)
        if (baseUrl === null) {
            accessStatus.textContent = ""
            return
        }
        void hasOriginPermission(baseUrl).then((granted) => {
            accessStatus.textContent = granted
                ? `Access granted for ${baseUrl}`
                : "Access not granted yet"
        })
    }

    const urlInput = textInput(initial.url, "http://127.0.0.1", () => scheduleApply())
    const portInput = numberInput(
        initial.port,
        "42908",
        { min: PORT_MIN, max: PORT_MAX, step: 1 },
        () => scheduleApply(),
    )
    const tokenInput = textInput(connection.token, "Paste the token from Datalith", () =>
        scheduleApply(),
    )
    void refreshAccess()

    return el("div", {}, [
        fieldRow("URL", urlInput, "Address of the machine running Datalith."),
        fieldRow("Port", portInput, "Port the Datalith Local Server listens on."),
        fieldRow(
            "Token",
            tokenInput,
            "Bearer token from Datalith's Clipper settings. Leave empty if Datalith has no token.",
        ),
        fieldRow(
            "Access",
            el("div", { className: "access-control" }, [accessButton, accessStatus]),
            "The extension asks for network access per origin so it can reach the Local Server.",
        ),
    ])
}

function debounce(run: () => void, waitMs: number): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined
    return () => {
        clearTimeout(timer)
        timer = setTimeout(run, waitMs)
    }
}

async function loadVaults(select: HTMLSelectElement): Promise<void> {
    select.replaceChildren(new Option("Loading vaults…", ""))
    select.disabled = true
    const response = (await browser.runtime.sendMessage({ type: "get-vaults" })) as VaultsResponse
    if (!response.ok) {
        select.replaceChildren(new Option(`Unavailable — ${response.error}`, ""))
        select.disabled = true
        return
    }
    if (response.vaults.length === 0) {
        select.replaceChildren(new Option("No vaults configured in Datalith.", ""))
        select.disabled = true
        return
    }
    const options = response.vaults.map((vault) => {
        const option = new Option(vault.name, vault.name)
        option.title = vault.path
        return option
    })
    select.replaceChildren(...options)
    select.disabled = false
}

function buildExportImport(ctx: PageContext): HTMLElement {
    const exportButton = actionButton("Export", () => {
        const blob = new Blob([exportPayload(ctx.state)], {
            type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "datalith-clipper-settings.json"
        link.click()
        URL.revokeObjectURL(url)
    })

    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = "application/json"
    fileInput.hidden = true
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0]
        if (!file) return
        try {
            const parsed: unknown = JSON.parse(await file.text())
            ctx.state.settings = importSettings(parsed)
            ctx.applyTheme()
            await ctx.save()
            ctx.rerender()
        } catch {
            // Invalid file — ignore.
        }
        fileInput.value = ""
    })
    const importButton = actionButton("Import", () => fileInput.click())

    const row = fieldRow(
        "Settings backup",
        el("span", { className: "button-row" }, [exportButton, importButton]),
        "Templates, themes, interpreter providers and preferences.",
    )
    return el("div", {}, [row, fileInput])
}
