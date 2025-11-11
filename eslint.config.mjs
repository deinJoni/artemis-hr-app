// Flat ESLint config for the monorepo
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/.next/**",
      "supabase/**",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
        // Use project-less mode for speed; enable projects per-package if needed
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // TS
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // JS
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-empty-pattern": "off",
      // React
      "react-refresh/only-export-components": "off",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // Frontend (browser globals)
  {
    files: ["apps/frontend/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        console: "readonly",
      },
    },
  },
  // Backend (node/bun globals)
  {
    files: ["apps/backend/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        process: "readonly",
        Bun: "readonly",
        console: "readonly",
        fetch: "readonly",
      },
    },
  },
];
