import { defineConfig } from "vite-plus"

// The extension build stays in scripts/build.ts; Vite+ owns tests, linting and formatting.
export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
    },
    fmt: {
        printWidth: 100,
        useTabs: false,
        tabWidth: 4,
        singleQuote: false,
        semi: false,
        trailingComma: "all",
        arrowParens: "always",
        sortPackageJson: false,
        ignorePatterns: ["THIRD-PARTY-NOTICES.md"],
        sortImports: {
            newlinesBetween: true,
        },
    },
    lint: {
        plugins: ["typescript", "import"],
        categories: {
            correctness: "error",
            perf: "error",
            suspicious: "error",
        },
        rules: {
            eqeqeq: ["error", "smart"],
            "no-unused-vars": [
                "error",
                {
                    ignoreRestSiblings: true,
                },
            ],
            "no-var": "error",
            "prefer-const": "error",
            "prefer-template": "error",
            "typescript/consistent-type-imports": "error",
            "typescript/consistent-type-exports": "error",
            "import/no-duplicates": "error",
            "import/no-cycle": "error",
            "import/no-unassigned-import": [
                "error",
                {
                    allow: ["**/*.css"],
                },
            ],
            "vite-plus/prefer-vite-plus-imports": "error",
        },
        options: {
            denyWarnings: true,
        },
        jsPlugins: [
            {
                name: "vite-plus",
                specifier: "vite-plus/oxlint-plugin",
            },
        ],
    },
})
