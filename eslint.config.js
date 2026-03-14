import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default [

    {
        ignores: [
            "node_modules",
            "dist",
            "build",
            "coverage",
            "*.config.js",
            "drizzle.config.ts",
        ],
    },

    js.configs.recommended,

    ...tseslint.configs.recommendedTypeChecked,

    prettier,

    {
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            "prettier/prettier": "warn",
        },
    },

    {
        files: ["**/*.ts"],

        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
            },

            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },

        rules: {

            /*
            Critical bug-prevention rules
            */

            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/await-thenable": "error",

            /*
            Type safety
            */

            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unnecessary-type-assertion": "error",

            /*
            Code quality
            */

            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/prefer-nullish-coalescing": "warn",
            "@typescript-eslint/prefer-optional-chain": "warn",

            /*
            Clean code
            */

            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_" },
            ],
        },
    },
];