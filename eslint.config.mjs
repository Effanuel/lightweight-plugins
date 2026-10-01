import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Copied verbatim from tradingview/lightweight-charts plugin-examples; never hand-edited, so not linted.
const vendored = [
  "src/helpers/**",
  "src/plugins/plugin-base.ts",
  "src/plugins/anchored-text/**",
  "src/plugins/background-shade-series/**",
  "src/plugins/bands-indicator/**",
  "src/plugins/box-whisker-series/**",
  "src/plugins/grouped-bars-series/**",
  "src/plugins/heatmap-series/**",
  "src/plugins/highlight-bar-crosshair/**",
  "src/plugins/lollipop-series/**",
  "src/plugins/overlay-price-scale/**",
  "src/plugins/partial-price-line/**",
  "src/plugins/session-highlighting/**",
  "src/plugins/trend-line/**",
  "src/plugins/user-price-lines/**",
  "src/plugins/volume-profile/**",
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".claude/**", "node_modules/**", "next-env.d.ts", ...vendored]),
]);
