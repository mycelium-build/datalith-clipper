# Store Listing

Copy for the Chrome Web Store and Firefox Add-ons (AMO). Keep both in sync with the manifest (`src/manifest.json`); bump descriptions when features change.

## Name

Datalith Clipper

## Summary (132 chars max)

Save web pages as clean Markdown notes into your local Datalith vaults with templates, highlights and a distraction-free reader.

## Category / Tags

- Category: Productivity (Chrome) / Bookmarks, Productivity (AMO)
- Keywords: notes, markdown, clipper, read-it-later, local-first

## Description

Datalith Clipper turns any web page into a clean Markdown note and files it straight
into your Datalith vault.

- One-click clips: the page title, properties and main content are prefilled for you
- Templates: variables (title, author, selection, highlights, image…), CSS-selector extraction, pipes, conditionals and loops — with per-site triggers that pick the right template automatically
- Interpreter: optionally run {"prompt"} expressions through your own OpenAI-compatible model provider to summarize or transform pages
- Highlighter: paint text on the page to collect quotes into your note
- Reader view: distraction-free reading with your choice of font, size and line height
- Themes: every Datalith app theme, light and dark

Everything is local: notes are saved to the Datalith app running on your own machine (127.0.0.1). There is no account, no cloud and no tracking.

## Permission justifications (Chrome Web Store review)

- `storage`: settings, templates and provider configuration are stored locally in the browser. No data is synced or sent anywhere except to the local Datalith app and the user-configured model provider.
- `host_permissions: http://127.0.0.1:42908/*`: the Local Server of the Datalith desktop app, used to list vaults and save notes. Loopback only.
- `optional_host_permissions: http://*/*, https://*/*`: only requested, per origin, when the user adds an Interpreter model provider (e.g. api.openai.com). Nothing is requested at install time.
- Content scripts (`http/https`): the panel, reader view and highlighter run in the page. Page content is read only when the user opens the panel or reader, and is sent only to the local app or the user's own model provider.
- `web_accessible_resources: fonts/*`: the bundled Pixeloid font is loaded into the panel's shadow root. No remote code is fetched or executed; all code ships in the package.

## Source code submission (AMO)

The build is unminified IIFE with inline source maps. Attach the repository archive at the matching tag when submitting, or reference the public repository and tag.

## Screenshots to capture

1. Panel on an article (light theme) — prefilled title/properties/content
2. Panel mid-highlight, two painted quotes
3. Reader view (dark theme)
4. Settings → Templates (Default template editor with reference bar)
5. Settings → Interpreter with a provider and model configured
