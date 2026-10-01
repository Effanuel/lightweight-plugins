import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Vendored from tradingview/lightweight-charts plugin-examples (changes listed in packages/lightweight-plugins/NOTICE); not linted.
const vendored = [
  "packages/lightweight-plugins/src/helpers/**",
  "packages/lightweight-plugins/src/plugins/**",
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".claude/**",
    "node_modules/**",
    "next-env.d.ts",
    "packages/*/dist/**",
    ...vendored,
  ]),
]);
