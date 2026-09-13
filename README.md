# Datalith Clipper

A browser extension (Chrome + Firefox) that clips web pages into [Datalith](https://github.com/mycelium-build/datalith-app), a local-first Vault where notes, links, and tasks sharpen into a monolith that lasts.

Select a vault, review the Clip in the Panel, and save it as a Markdown Note in your vault, everything stays on your machine, talking to the Datalith app over its Local Server.

For more info go to [Datalith's website](https://mycelium-build.github.io/datalith/).

## Features

- **Clip any page** into a clean Markdown Note: content extracted and converted, with title, author, description and word count resolved automatically
- **Panel**, a full-height sidebar to review the Clip before saving: edit the name, properties and content with live Markdown preview, pick vault and folder
- **Templates**, named recipes that fill the Note for you: variables, CSS-selector extraction, conditionals, loops and pipes. A trigger (URL glob) can auto-select the right Template per site
- **Interpreter**, optional LLM support that evaluates `{{"prompt"}}` expressions through your own OpenAI-compatible provider (off by default)
- **Highlights**: paint text on the page in highlighter mode and it lands in the saved Note
- **Reader view**: a distraction-free overlay with configurable font, size, line height and link coloring
- **Themes**: light, dark or auto, matching Datalith's own themes

## Requirements

- The [Datalith app](https://github.com/mycelium-build/datalith-app) running locally, the Clipper Local Server listens on `127.0.0.1:42908` by default
- Chrome based or Firefox based browser

## Installation

Download the latest zip for your browser from [Releases](https://github.com/mycelium-build/datalith-clipper/releases), unzip it, then load the unpacked extension:

- **Chrome**: `chrome://extensions` → enable Developer mode → **Load unpacked** → select the unzipped `chrome` folder
- **Firefox**: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick any file inside the unzipped `firefox` folder (Firefox removes temporary add-ons on restart)

## Getting started

1. In Datalith, open **Settings → Clipper** and make sure the Local Server is enabled. If you set a token there, you will need it in the next step.
2. In the extension's options, under **General → Connection**, check the URL and Port match Datalith's Clipper settings and paste the token if you use one.
3. Click **Sync** and your vaults appear. That's it: click the toolbar icon on any page to open the Panel and save your first Note.

## Support

For bug reports and feature requests about Datalith Clipper, [open an issue on GitHub](https://github.com/mycelium-build/datalith-clipper/issues).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes in each version.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and project guidelines.

## Licensing

Datalith Clipper's original source code and artwork are licensed under the [MIT License](LICENSE).
Imported assets and dependencies retain their own licenses; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
