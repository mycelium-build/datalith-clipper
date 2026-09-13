# Changelog

All notable changes will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Full-height Panel with template selection, editable properties, markdown content with preview, vault/folder selection, variables view and minimize pill
- Knap templating engine: variables, CSS-selector extraction, conditionals, loops, set, fallback (`??`) and pipes (`calc`, `join`, `slice`, `date_modify`, …)
- Page extraction with Defuddle (markdown content, author, description, word count) and an image heuristic (og:image first, keyword/size/aspect filtering)
- Highlighter: paint page text into session highlights, appended to the note
- Reader view: distraction-free overlay with configurable font, size, line height and link coloring
- Interpreter: `{{"prompt"}}` expressions executed through user-configured OpenAI-compatible providers (per-origin optional host permission, 60s timeout, per-render cache, template-level context override)
- Templates: stored in settings with triggers (URL globs), reorder, delete and a full editor with templating reference sidebar; seeded Default template
- Settings pages: General (vaults, themes, hotkeys, behavior, export/import), Reader, Interpreter and Templates
- Save pipeline: Local Server client, launch-and-retry via `datalith://launch` when the app is down, optional `datalith://open?path=…` reveal after saving
- Asset pipeline: themes, icons and fonts synced from the Datalith app repo and built into CSS custom properties and an icon module
- Chrome and Firefox builds from one codebase with packaging scripts and store listing documentation
