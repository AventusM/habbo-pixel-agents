import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "assets/**",
      ".agents/**",
      ".gsd/**",
      "packages/**/dist/**",
      "scripts/exp/runs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.ts"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Existing backlog: 89 explicit `any` usages predate this gate.
      // Kept visible as warnings; tightening to error is a tracked follow-up.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Intentional swallow-and-ignore catches exist in optional-feature probes.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);
