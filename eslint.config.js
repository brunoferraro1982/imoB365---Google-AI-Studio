import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi", "public/sw.js"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Código gerado pelo Lovable — tratar como warn em vez de error
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unused-expressions": "warn",
      // Blocos catch vazios são comuns em código gerado — warn
      "no-empty": ["warn", { allowEmptyCatch: true }],
      // Hooks em funções com underscore (_SiteHeader) — padrão Lovable
      "react-hooks/rules-of-hooks": "warn",
    },
  },
  eslintPluginPrettier,
);
