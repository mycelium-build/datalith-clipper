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
        categories: { correctness: "error", perf: "error", suspicious: "error" },
        jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
        rules: {
            "vite-plus/prefer-vite-plus-imports": "error",
            eqeqeq: ["error", "smart"],
            "no-await-in-loop": "off",
            "no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_" }],
            "no-var": "error",
            "prefer-const": "error",
            "prefer-template": "error",
            "promise/prefer-await-to-then": "error",
            "typescript/consistent-type-imports": "error",
            "typescript/consistent-type-exports": "error",
            "typescript/no-unnecessary-type-parameters": "off",
            "typescript/no-unsafe-type-assertion": "off",
            "import/no-duplicates": "error",
            "import/no-cycle": "error",
            "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
        },
        options: { typeAware: true, typeCheck: true, denyWarnings: true },
    },
})
