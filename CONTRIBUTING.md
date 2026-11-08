# Contributing

We welcome contributions! Here's how you can get involved:

## Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Project Guidelines

- Your branch name should follow [Conventional Branch](https://conventionalbranch.org/) format
- Use TypeScript with strict compiler checks
- Follow the existing code style
- Add doc comments for public items
- Write clear, descriptive commit messages following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) style

## Testing

Before submitting a pull request, please ensure that:

1. The project builds without errors (`npm run build`)
2. You run the formatter (`npm run fmt:check`)
3. You run the linter and fix all issues (`npm run lint`)
4. All tests pass (`npm test`)
5. The code follows the project guidelines
6. New functionality includes appropriate tests

## Third-Party Notices

When adding an npm dependency, update `package.json` and `package-lock.json`.
When adding a bundled asset, update `scripts/licenses/assets.json` and include its license file.
Do not edit `THIRD-PARTY-NOTICES.md` by hand; regenerate it with:

```bash
npm run licenses:generate
```

Before submitting a pull request, verify the result with:

```bash
npm run licenses:check
```

## Development Setup

### Prerequisites

- Node.js and npm
- Git
- [prek](https://prek.j178.dev), to run the Git hooks
- A checkout of the Datalith repository at `../datalith-app`, or a local source path configured with `DATALITH_SOURCE_DIR`

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/mycelium-build/datalith-clipper.git
    cd datalith-clipper
    ```

2. Install dependencies and enable the Git hooks:

    ```bash
    npm ci
    brew install prek        # or: uv tool install prek, or: cargo install --locked prek
    prek install
    ```

    `prek install` reads `.pre-commit-config.yaml` and installs both hooks once for the clone:

    | Hook       | Runs when                                        | What it does                                                      |
    | ---------- | ------------------------------------------------ | ----------------------------------------------------------------- |
    | pre-commit | staged files                                     | `oxfmt` formats them and stages the result; `oxlint`, `stylelint` |
    | pre-commit | `package*.json`, notices or license files staged | `licenses:check`; stale notices are regenerated and staged        |
    | pre-push   | the pushed commits touch code or `package*.json` | `npm run typecheck`, `npm test`                                   |

    The formatting and notice fixes only touch what you staged: prek sets unstaged changes aside while the hooks run.
    If a fix conflicts with unstaged changes in the same file, prek drops it and stops the commit; format or stage the file yourself and commit again.
    A `licenses:check` failure that regenerating the notices does not explain stops the commit.
    Run every pre-commit hook on the whole tree with `prek run --all-files`.
    Bypass a hook once with `--no-verify`; CI runs the same checks.
    The pre-push typecheck needs the generated files (`src/lib/icons.ts`, `src/data/themes.json`), so run steps 3 once before your first push.

3. Build:

    ```bash
    npm run sync-assets
    npm run build        # bundles to dist/chrome and dist/firefox
    ```

4. Load the unpacked extension:

    - **Chrome**: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome`
    - **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick any file in `dist/firefox`

5. Rebuild on change while developing:

    ```bash
    npm run watch
    ```

### Development Workflow

1. Make changes to the source code in the `src/` directory.

2. Run tests:

    ```bash
    npm test
    ```

3. Check for lint issues:

    ```bash
    npm run lint
    ```

## Datalith API compatibility

The Clipper supports Datalith local API version 1. Before listing vaults or saving a note,
it calls `/ping` and checks `api_version`, independently of the app's release version.
A missing or older API version asks the user to update Datalith; a newer version asks
for a Clipper update. Both block vault requests and note writes. The check runs for each
operation; an unreachable app keeps the existing launch-and-retry behavior.

Publish the app release exposing `api_version` before distributing this Clipper version.

## Dependency updates

Dependency updates are opened by a self-hosted Renovate run from datalith-app (`renovate.json`); its Dependency Dashboard is an issue of this repository. After an npm update, `scripts/renovate-post-upgrade.sh` regenerates `THIRD-PARTY-NOTICES.md`.

## Our stance on AI

We allow PR made with AI, but you are responsible for your code. This implies that you have reread all your code and reaches a good quality. You should always understand what you have done. If you clearly did not read the code or it is fully vibe coded we allow ourselves to close the PR without reason.

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.
