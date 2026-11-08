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
- GitHub access to download public assets from the latest stable Datalith release

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

    | Hook       | Runs when                                        | What it does                                                        |
    | ---------- | ------------------------------------------------ | ------------------------------------------------------------------- |
    | pre-commit | staged files                                     | `vp fmt` formats them and stages the result; `vp lint`, `stylelint` |
    | pre-commit | `package*.json`, notices or license files staged | `licenses:check`; stale notices are regenerated and staged          |
    | pre-push   | the pushed commits touch code or `package*.json` | `npm run check`, `npm test`                                         |

    The formatting and notice fixes only touch what you staged: prek sets unstaged changes aside while the hooks run.
    If a fix conflicts with unstaged changes in the same file, prek drops it and stops the commit; format or stage the file yourself and commit again.
    A `licenses:check` failure that regenerating the notices does not explain stops the commit.
    Run every pre-commit hook on the whole tree with `prek run --all-files`.
    Bypass a hook once with `--no-verify`; CI runs the same checks.
    The pre-push check needs the generated files (`src/lib/icons.ts`, `src/data/themes.json`), so run steps 3 once before your first push.

3. Build:

    ```bash
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

## Dependency updates

Dependency updates are opened by a self-hosted Renovate run from datalith-app (`renovate.json`); its Dependency Dashboard is an issue of this repository. After an npm update, `scripts/renovate-post-upgrade.sh` regenerates `THIRD-PARTY-NOTICES.md`.

## Asset sources

Every build and watch startup syncs assets from the latest stable Datalith release,
then regenerates icons, themes and bundled license notices. Development overrides
can be set in `.env` or on the command line:

```bash
DATALITH_SOURCE_REF=main npm run build
DATALITH_SOURCE_REF=v1.1.0 npm run build
DATALITH_SOURCE_DIR=../datalith-app npm run build
```

Local directory overrides are refused in CI. Stable tags are cached under `.cache/`;
branches are refreshed on each build. Restart watch mode to refresh assets.
Public clones need no token; `GH_TOKEN`, `GITHUB_TOKEN` or `DATALITH_READ_TOKEN`
can raise the GitHub API rate limit.

CI checks committed npm notices with `licenses:check -- --dependencies-only`.
Each build validates asset licenses and includes complete notices in both bundles.
The full `licenses:check` remains available locally.

## Our stance on AI

We allow PR made with AI, but you are responsible for your code. This implies that you have reread all your code and reaches a good quality. You should always understand what you have done. If you clearly did not read the code or it is fully vibe coded we allow ourselves to close the PR without reason.

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## Toolchain

Vite+ runs formatting, linting and tests through the existing `npm run fmt`, `npm run lint` and `npm test` commands. Their shared configuration is in `vite.config.ts`. Like the site, `npm run check` combines formatting, type-aware linting, type checking and Stylelint. It runs in CI and before pushing. `npm run typecheck` remains available for the standalone TypeScript check. The Chrome/Firefox extension build remains the custom Rolldown script in `scripts/build.ts`.

Keep `vite-plus`, its `vite` alias and the bundled Vitest override aligned; Renovate groups these updates.
