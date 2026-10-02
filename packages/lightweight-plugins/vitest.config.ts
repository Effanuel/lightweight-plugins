import { defineConfig } from "vitest/config";

// Node by default, like terminal; DOM tests opt in with `// @vitest-environment jsdom`.
export default defineConfig({
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
