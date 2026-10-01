# Publishable Plugins Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the 14 TradingView-derived lightweight-charts plugins from this repo as the npm package `@effanuel/lightweight-plugins`, importable with one `import { … } from '@effanuel/lightweight-plugins'`, while the Next.js demo app keeps building and deploying unchanged.

**Architecture:** A pnpm workspace. The Next app stays at the repo root, and the plugins move with `git mv` (byte-identical) into `packages/lightweight-plugins/src/`, keeping their relative layout. A hand-written `src/index.ts` is the single public entry point. tsup bundles it into one ESM `dist/index.js` plus `index.d.ts`, with `lightweight-charts` external as a peer dependency.

**Tech Stack:** pnpm 10 workspaces, tsup 8.5, TypeScript 6.0, lightweight-charts 5, Node ESM; publint and @arethetypeswrong/cli for package checks; Vite + Playwright for a throwaway consumer check.

**Spec:** `docs/superpowers/specs/2026-10-01-plugins-package-design.md`

**Working directory:** the worktree `/home/vecordis/GitHub/lightweight-plugins/.claude/worktrees/plugins-package` (branch `feat/plugins-package`). Every path below is relative to it. `$SP` means the executing session's scratchpad directory.

## Global Constraints

- Package name `@effanuel/lightweight-plugins`, version `0.1.0`, license `Apache-2.0`.
- ESM only (`"type": "module"`), a single entry point (`exports["."]`), no subpath exports.
- `peerDependencies`: `"lightweight-charts": "^5.0.0"`. Narrow it only if Task 3 proves 5.0.0 broken. `dependencies`: `"fancy-canvas": "~2.1.0"`.
- `lightweight-charts` must stay a peer, never only a devDependency: tsup externalizes peers and deps but bundles devDependencies (spike-verified).
- TypeScript `~6.0.3`. The package `tsconfig.json` needs `"ignoreDeprecations": "6.0"`: tsup's dts step injects `baseUrl`, which TS 6 rejects with TS5101 (spike-verified).
- Moved files stay **byte-identical**: git must report every move as `R100`.
- App source (`src/**` outside the moved files) is not edited. Only the root config files named in Task 1 change.
- Do not run `npm publish` / `pnpm publish`; the user publishes.
- Stage files by explicit path. Never use `git add -A`, `git add .` or `git commit -a`.
- Commits use conventional format and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **`lightweight-charts` bundled into `dist`.** A consumer's chart would talk to a second copy of the library, and plugins would silently misbehave. Expect `dist/index.js` to import from `"lightweight-charts"` and contain none of its code. Pinned in Task 1's smoke test.
2. **Consumer on the oldest peer in range (`lightweight-charts@5.0.0`).** Expect the plugins to type-check and render, or the peer range to be narrowed to what works. Pinned in Task 3, Step 8.
3. **Consumer imports one plugin.** Expect the bundle to exclude the other plugins' code. Pinned in Task 3, Step 4.
4. **Consumer under pnpm's strict `node_modules` with `skipLibCheck: false`.** Expect `fancy-canvas` types referenced by our `.d.ts` to resolve. Pinned in Task 3, Step 3.
5. **Interaction-only plugins (`CrosshairHighlightPrimitive`, `UserPriceLines`) under real mouse input.** Expect a highlight band on hover and a dashed price line added on click near the price scale. Pinned in Task 3, Steps 6–7.

---

### Task 1: Workspace package that builds and passes a smoke test

**Files:**
- Move (git mv): `src/plugins/{anchored-text,background-shade-series,bands-indicator,box-whisker-series,grouped-bars-series,heatmap-series,highlight-bar-crosshair,lollipop-series,overlay-price-scale,partial-price-line,session-highlighting,trend-line,user-price-lines,volume-profile}/` → `packages/lightweight-plugins/src/plugins/<same>/`
- Move: `src/plugins/plugin-base.ts` → `packages/lightweight-plugins/src/plugins/plugin-base.ts`
- Move: `src/helpers/` → `packages/lightweight-plugins/src/helpers/`
- Create: `packages/lightweight-plugins/package.json`
- Create: `packages/lightweight-plugins/tsconfig.json`
- Create: `packages/lightweight-plugins/tsup.config.ts`
- Create: `packages/lightweight-plugins/src/index.ts`
- Test: `packages/lightweight-plugins/test/smoke.mjs`
- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (scripts), `tsconfig.json` (exclude), `eslint.config.mjs` (vendored paths), `.gitignore`, `pnpm-lock.yaml` (regenerated)

**Interfaces:**
- Consumes: nothing.
- Produces: the built `packages/lightweight-plugins/dist/index.js` and `dist/index.d.ts`, with exactly these 14 runtime exports: `AnchoredText, BackgroundShadeSeries, BandsIndicator, CrosshairHighlightPrimitive, GroupedBarsSeries, HeatMapSeries, LollipopSeries, OverlayPriceScale, PartialPriceLine, SessionHighlighting, TrendLine, UserPriceLines, VolumeProfile, WhiskerBoxSeries`. Type exports: `AnchoredTextOptions, BackgroundShadeSeriesOptions, BandsIndicatorOptions, WhiskerBoxSeriesOptions, WhiskerData, GroupedBarsSeriesOptions, GroupedBarsData, HeatMapSeriesOptions, HeatMapCellShader, HeatMapData, HeatmapCell, HighlightBarCrosshairOptions, LollipopSeriesOptions, LollipopData, OverlayPriceScaleOptions, SessionHighlightingOptions, SessionHighlighter, TrendLineOptions, UserPriceLinesOptions, VolumeProfileData`. Root scripts `build:plugins`; package scripts `build`, `test`.

- [ ] **Step 1: Move the plugin sources into the package (history kept)**

```bash
mkdir -p packages/lightweight-plugins/src/plugins
for p in anchored-text background-shade-series bands-indicator box-whisker-series grouped-bars-series heatmap-series highlight-bar-crosshair lollipop-series overlay-price-scale partial-price-line session-highlighting trend-line user-price-lines volume-profile; do
  git mv "src/plugins/$p" "packages/lightweight-plugins/src/plugins/$p"
done
git mv src/plugins/plugin-base.ts packages/lightweight-plugins/src/plugins/plugin-base.ts
git mv src/helpers packages/lightweight-plugins/src/helpers
```

Verify they are pure renames:

```bash
git diff --cached -M --name-status | grep -v '^R100' ; echo "non-R100 lines: $?"
ls src/plugins
```

Expected: `grep` prints nothing and exits 1, so the output ends with `non-R100 lines: 1`. `ls src/plugins` shows only `position-plugin  price-line.ts  utils`.

- [ ] **Step 2: Write the failing smoke test**

`packages/lightweight-plugins/test/smoke.mjs`:

```js
// Smoke check for the built package. Run `pnpm build` first, then `pnpm test`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const EXPECTED = [
	'AnchoredText',
	'BackgroundShadeSeries',
	'BandsIndicator',
	'CrosshairHighlightPrimitive',
	'GroupedBarsSeries',
	'HeatMapSeries',
	'LollipopSeries',
	'OverlayPriceScale',
	'PartialPriceLine',
	'SessionHighlighting',
	'TrendLine',
	'UserPriceLines',
	'VolumeProfile',
	'WhiskerBoxSeries',
];

// Imports in plain Node with no DOM, as SSR and test runners do.
const mod = await import('../dist/index.js');
assert.deepEqual(Object.keys(mod).sort(), [...EXPECTED].sort(), 'runtime exports');
for (const name of EXPECTED) assert.equal(typeof mod[name], 'function', name);

// lightweight-charts must stay external, or consumers get a second copy of the library.
const bundle = readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8');
assert.match(bundle, /from "lightweight-charts"/, 'imports lightweight-charts');
assert.doesNotMatch(bundle, /Lightweight Charts™/, 'does not bundle lightweight-charts');

console.log(`smoke ok: ${EXPECTED.length} exports, lightweight-charts external`);
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node packages/lightweight-plugins/test/smoke.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `…/packages/lightweight-plugins/dist/index.js`.

- [ ] **Step 4: Create the package manifest and build config**

`packages/lightweight-plugins/package.json`:

```json
{
  "name": "@effanuel/lightweight-plugins",
  "version": "0.1.0",
  "description": "Plugins for TradingView lightweight-charts v5",
  "keywords": ["lightweight-charts", "tradingview", "charts", "plugins"],
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "NOTICE"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Effanuel/lightweight-plugins.git",
    "directory": "packages/lightweight-plugins"
  },
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsup",
    "test": "node test/smoke.mjs",
    "prepublishOnly": "pnpm build"
  },
  "peerDependencies": {
    "lightweight-charts": "^5.0.0"
  },
  "dependencies": {
    "fancy-canvas": "~2.1.0"
  },
  "devDependencies": {
    "lightweight-charts": "^5.2.1",
    "tsup": "^8.5.1",
    "typescript": "~6.0.3"
  }
}
```

`packages/lightweight-plugins/tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "ES2020",
    "lib": ["dom", "esnext"],
    "skipLibCheck": true,
    "noEmit": true,
    "ignoreDeprecations": "6.0"
  },
  "include": ["src"]
}
```

`packages/lightweight-plugins/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

// ponytail: single bundled entry; a consumer importing one plugin still keeps a few hundred
// bytes of other plugins' defaultOptions literals. Split into per-plugin entries if that matters.
export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	sourcemap: true,
	clean: true,
});
```

- [ ] **Step 5: Write the public entry point**

`packages/lightweight-plugins/src/index.ts`:

```ts
export { AnchoredText } from './plugins/anchored-text/anchored-text';
// Upstream doesn't export AnchoredText's options interface; derive it so consumers can name it.
export type AnchoredTextOptions = ConstructorParameters<
	typeof import('./plugins/anchored-text/anchored-text').AnchoredText
>[0];

export { BackgroundShadeSeries } from './plugins/background-shade-series/background-shade-series';
export type { BackgroundShadeSeriesOptions } from './plugins/background-shade-series/options';

export { BandsIndicator, type BandsIndicatorOptions } from './plugins/bands-indicator/bands-indicator';

export { WhiskerBoxSeries } from './plugins/box-whisker-series/box-whisker-series';
export type { WhiskerBoxSeriesOptions } from './plugins/box-whisker-series/options';
export type { WhiskerData } from './plugins/box-whisker-series/sample-data';

export { GroupedBarsSeries } from './plugins/grouped-bars-series/grouped-bars-series';
export type { GroupedBarsSeriesOptions } from './plugins/grouped-bars-series/options';
export type { GroupedBarsData } from './plugins/grouped-bars-series/data';

export { HeatMapSeries } from './plugins/heatmap-series/heatmap-series';
export type { HeatMapSeriesOptions, HeatMapCellShader } from './plugins/heatmap-series/options';
export type { HeatMapData, HeatmapCell } from './plugins/heatmap-series/data';

export {
	CrosshairHighlightPrimitive,
	type HighlightBarCrosshairOptions,
} from './plugins/highlight-bar-crosshair/highlight-bar-crosshair';

export { LollipopSeries } from './plugins/lollipop-series/lollipop-series';
export type { LollipopSeriesOptions } from './plugins/lollipop-series/options';
export type { LollipopData } from './plugins/lollipop-series/data';

export {
	OverlayPriceScale,
	type OverlayPriceScaleOptions,
} from './plugins/overlay-price-scale/overlay-price-scale';

export { PartialPriceLine } from './plugins/partial-price-line/partial-price-line';

export {
	SessionHighlighting,
	type SessionHighlightingOptions,
	type SessionHighlighter,
} from './plugins/session-highlighting/session-highlighting';

export { TrendLine, type TrendLineOptions } from './plugins/trend-line/trend-line';

export { UserPriceLines, type UserPriceLinesOptions } from './plugins/user-price-lines/user-price-lines';

export { VolumeProfile, type VolumeProfileData } from './plugins/volume-profile/volume-profile';
```

- [ ] **Step 6: Wire the workspace into the root**

`pnpm-workspace.yaml`:

```yaml
packages:
  - packages/*
```

`package.json` (root): add one script after `"lint"`:

```json
    "lint": "eslint .",
    "build:plugins": "pnpm -F @effanuel/lightweight-plugins build"
```

`tsconfig.json` (root): change the `exclude` array to:

```json
  "exclude": [
    "node_modules",
    "packages"
  ]
```

`eslint.config.mjs`: replace the `vendored` array and the `globalIgnores` line with:

```js
// Copied verbatim from tradingview/lightweight-charts plugin-examples; never hand-edited, so not linted.
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
```

(`packages/lightweight-plugins/src/plugins/**` now holds only the 14 vendored plugins and `plugin-base.ts`, so one glob replaces the 15 entries. `src/index.ts` stays linted.)

`.gitignore`: under the `# production` section, after `/build`, add:

```
packages/*/dist
```

- [ ] **Step 7: Install and build**

```bash
pnpm install
pnpm build:plugins
```

Expected: `pnpm install` finishes without errors (an engine warning about Node 24.x vs the local Node is fine). The build ends with `ESM ⚡️ Build success` and `DTS ⚡️ Build success`, and lists `dist/index.js`, `dist/index.js.map` and `dist/index.d.ts`.

If the DTS step fails with `TS5101 … 'baseUrl' is deprecated`, the `ignoreDeprecations` line from Step 4 is missing.

- [ ] **Step 8: Run the smoke test to verify it passes**

Run: `pnpm -F @effanuel/lightweight-plugins test`
Expected: `smoke ok: 14 exports, lightweight-charts external`

- [ ] **Step 9: Verify the app still builds and lints**

```bash
pnpm lint
pnpm build
```

Expected: `pnpm lint` reports 0 errors (warnings allowed, as on master). `pnpm build` (next build) completes and lists the routes `/`, `/cvd` and `/orderflow`. If lint reports errors in `packages/lightweight-plugins/src/index.ts`, `tsup.config.ts` or `test/smoke.mjs`, fix them in those files only.

- [ ] **Step 10: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.json eslint.config.mjs .gitignore pnpm-lock.yaml \
  packages/lightweight-plugins/package.json packages/lightweight-plugins/tsconfig.json \
  packages/lightweight-plugins/tsup.config.ts packages/lightweight-plugins/src/index.ts \
  packages/lightweight-plugins/test/smoke.mjs
git status --short   # moved files are already staged from Step 1; nothing under dist/ may appear
git commit -m "feat: extract plugins into @effanuel/lightweight-plugins package

Moves the 14 TradingView-derived plugins, plugin-base and helpers into a
pnpm workspace package, unchanged. tsup builds a single ESM entry with
lightweight-charts as a peer.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: License, attribution and docs, passing package linters

**Files:**
- Create: `packages/lightweight-plugins/LICENSE`
- Create: `packages/lightweight-plugins/NOTICE`
- Create: `packages/lightweight-plugins/README.md`
- Modify: `README.md` (root)

**Interfaces:**
- Consumes: Task 1's built package (`pnpm build:plugins`) and its export names.
- Produces: a package directory where `npm pack` contains `LICENSE`, `NOTICE`, `README.md`, `package.json` and `dist/*`, and publint/attw report no problems.

- [ ] **Step 1: Run the package linters first (they should pass on exports, and the pack lacks docs)**

```bash
cd packages/lightweight-plugins
pnpm dlx publint
npm pack --dry-run 2>&1 | grep -E "LICENSE|NOTICE|README" ; echo "doc files listed: $?"
cd ../..
```

Expected: publint prints its summary (`All good!` or suggestions only, no errors). The grep finds nothing and the output ends with `doc files listed: 1`, which confirms the docs are missing from the tarball.

- [ ] **Step 2: Add LICENSE from upstream at the pinned tag**

```bash
gh api 'repos/tradingview/lightweight-charts/contents/LICENSE?ref=v5.2.1' --jq .content | base64 -d > packages/lightweight-plugins/LICENSE
head -3 packages/lightweight-plugins/LICENSE
```

Expected: the first lines are the Apache License, Version 2.0 header.

- [ ] **Step 3: Add NOTICE**

`packages/lightweight-plugins/NOTICE` (upstream's NOTICE verbatim, then the inclusion statement):

```
TradingView Lightweight Charts™
Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/

This package includes plugin code from tradingview/lightweight-charts
plugin-examples at tag v5.2.1, unmodified apart from file location.
```

- [ ] **Step 4: Verify the demo links before writing them**

```bash
for p in anchored-text bands-indicator highlight-bar-crosshair overlay-price-scale partial-price-line session-highlighting trend-line user-price-lines volume-profile background-shade-series box-whisker-series grouped-bars-series heatmap-series lollipop-series; do
  printf "%s %s\n" "$(curl -s -o /dev/null -w '%{http_code}' "https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/$p/example/")" "$p"
done
```

Expected: all 14 lines start with `200`. For any that don't, drop the demo link for that row in Step 5 and keep only the source link.

- [ ] **Step 5: Write the package README**

`packages/lightweight-plugins/README.md`:

````markdown
# @effanuel/lightweight-plugins

Plugins for [TradingView Lightweight Charts™](https://github.com/tradingview/lightweight-charts) v5: series primitives, a price-line tool, and custom series, in one tree-shakeable ES module.

## Install

```sh
pnpm add @effanuel/lightweight-plugins lightweight-charts
```

`lightweight-charts` `^5.0.0` is a peer dependency. The package is ESM-only.

## Usage

Primitives attach to an existing series:

```ts
import { createChart, LineSeries } from 'lightweight-charts';
import { TrendLine } from '@effanuel/lightweight-plugins';

const chart = createChart(document.getElementById('chart')!);
const series = chart.addSeries(LineSeries);
series.setData(data);

series.attachPrimitive(
	new TrendLine(
		chart,
		series,
		{ time: data[10].time, price: data[10].value },
		{ time: data[40].time, price: data[40].value },
		{ lineColor: '#d50000', width: 2 },
	),
);
```

Custom series are added with `addCustomSeries`:

```ts
import { HeatMapSeries, type HeatMapData } from '@effanuel/lightweight-plugins';

const data: HeatMapData[] = [
	{ time: '2024-01-02', cells: [{ low: 10, high: 20, amount: 40 }, { low: 20, high: 30, amount: 90 }] },
];
chart.addCustomSeries(new HeatMapSeries()).setData(data);
```

Each plugin's options and data types are exported next to it (for example `TrendLineOptions`, `HeatMapData`).

## Plugins

| Export | Kind | What it does | Links |
|---|---|---|---|
| `AnchoredText` | primitive | Text anchored to a fixed spot in the pane, e.g. a watermark | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/anchored-text/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/anchored-text) |
| `BandsIndicator` | primitive | Upper and lower bands around the series with a filled area | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/bands-indicator/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/bands-indicator) |
| `CrosshairHighlightPrimitive` | primitive | Highlights the bar under the crosshair | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/highlight-bar-crosshair/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/highlight-bar-crosshair) |
| `OverlayPriceScale` | primitive | A price scale drawn as an overlay inside the pane | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/overlay-price-scale/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/overlay-price-scale) |
| `PartialPriceLine` | primitive | Last-value price line that spans only part of the pane | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/partial-price-line/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/partial-price-line) |
| `SessionHighlighting` | primitive | Colours each bar's background from a callback, e.g. by trading session | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/session-highlighting/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/session-highlighting) |
| `TrendLine` | primitive | Line between two time/price points, with optional price labels | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/trend-line/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/trend-line) |
| `UserPriceLines` | tool | Hover the price scale and click the "+" button to add a price line | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/user-price-lines/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/user-price-lines) |
| `VolumeProfile` | primitive | Volume-at-price histogram anchored to a point in time | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/volume-profile/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/volume-profile) |
| `BackgroundShadeSeries` | custom series | Shades the background between two colours by value | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/background-shade-series/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/background-shade-series) |
| `WhiskerBoxSeries` | custom series | Box-and-whisker (quartiles) plot per bar | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/box-whisker-series/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/box-whisker-series) |
| `GroupedBarsSeries` | custom series | Several bars side by side per time point | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/grouped-bars-series/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/grouped-bars-series) |
| `HeatMapSeries` | custom series | Heatmap cells over price ranges per bar | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/heatmap-series/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/heatmap-series) |
| `LollipopSeries` | custom series | Lollipop chart: a stem and a dot per value | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/lollipop-series/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/lollipop-series) |

## License

Apache-2.0. The plugins are TradingView's `plugin-examples` from lightweight-charts v5.2.1, unmodified apart from file location. See [NOTICE](./NOTICE).
````

- [ ] **Step 6: Point the root README at the package**

In `README.md` (root), after the line `Deployed at https://lightweight-plugins.vercel.app/`, add a blank line and:

```markdown
The chart plugins are published on npm as [`@effanuel/lightweight-plugins`](./packages/lightweight-plugins).
```

- [ ] **Step 7: Run the package linters and pack listing to verify they pass**

```bash
pnpm build:plugins
cd packages/lightweight-plugins
pnpm dlx publint
pnpm dlx @arethetypeswrong/cli --pack --profile esm-only
npm pack --dry-run 2>&1 | grep -E "LICENSE|NOTICE|README|package.json|dist/"
cd ../..
```

Expected:
- publint reports no errors.
- attw prints a table with 🟢 for the `node16 (from ESM)` and `bundler` columns and ends with `No problems found 🌟`.
- The pack listing includes `LICENSE`, `NOTICE`, `README.md`, `package.json`, `dist/index.js`, `dist/index.js.map` and `dist/index.d.ts`, and no `src/` or `test/`.

If attw reports a problem, fix `package.json` `exports`/`types` (not the sources) and rerun.

- [ ] **Step 8: Commit**

```bash
git add packages/lightweight-plugins/LICENSE packages/lightweight-plugins/NOTICE packages/lightweight-plugins/README.md README.md
git commit -m "docs: license, notice and readme for plugins package

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Real-consumer check from the packed tarball (throwaway)

Nothing from this task is committed unless Step 8 narrows the peer range. Everything lives in `$SP/consumer` and `$SP/browser-check`.

**Files:**
- Create (throwaway): `$SP/consumer/{package.json,tsconfig.json,index.html,src/main.ts,treeshake.mjs}`
- Create (throwaway): `$SP/browser-check/{package.json,check.mjs}`
- Modify (only if Step 8 fails on 5.0.0): `packages/lightweight-plugins/package.json` (`peerDependencies`), README install note

**Interfaces:**
- Consumes: the tarball `packages/lightweight-plugins/effanuel-lightweight-plugins-0.1.0.tgz` (from `pnpm pack`), and every export and type name listed in Task 1's Produces.
- Produces: screenshots `$SP/browser-check/out/<Export>.png` × 14, and a pass/fail verdict.

- [ ] **Step 1: Pack the package**

```bash
pnpm build:plugins
cd packages/lightweight-plugins && pnpm pack --pack-destination "$SP" && cd ../..
ls "$SP"/effanuel-lightweight-plugins-0.1.0.tgz
```

Expected: the tarball path is listed.

- [ ] **Step 2: Create a blank Vite + TS consumer that installs the tarball**

```bash
mkdir -p "$SP/consumer/src" && cd "$SP/consumer"
```

`$SP/consumer/package.json`:

```json
{
  "name": "consumer-check",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "vite build",
    "preview": "vite preview --port 4173 --strictPort"
  }
}
```

`$SP/consumer/tsconfig.json` (`skipLibCheck: false`, so our `.d.ts` is fully checked):

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "ES2020",
    "lib": ["dom", "esnext"],
    "skipLibCheck": false,
    "noEmit": true
  },
  "include": ["src"]
}
```

`$SP/consumer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>plugins consumer check</title>
    <style>
      body { margin: 0; font: 14px sans-serif; background: #fff; }
      #grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 12px; }
      h2 { margin: 0 0 4px; font-size: 14px; }
      .chart { height: 260px; }
    </style>
  </head>
  <body>
    <div id="grid"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Install (pnpm's strict `node_modules`, so `fancy-canvas` is reachable only through our package):

```bash
pnpm add "$SP/effanuel-lightweight-plugins-0.1.0.tgz" lightweight-charts@^5.2.1
pnpm add -D vite typescript@~6.0.3
```

- [ ] **Step 3: Write the page that uses all 14 plugins, then type-check it**

`$SP/consumer/src/main.ts`:

```ts
import {
	createChart,
	LineSeries,
	CandlestickSeries,
	type IChartApi,
	type ISeriesApi,
	type UTCTimestamp,
} from 'lightweight-charts';
import {
	AnchoredText,
	BackgroundShadeSeries,
	BandsIndicator,
	CrosshairHighlightPrimitive,
	GroupedBarsSeries,
	HeatMapSeries,
	LollipopSeries,
	OverlayPriceScale,
	PartialPriceLine,
	SessionHighlighting,
	TrendLine,
	UserPriceLines,
	VolumeProfile,
	WhiskerBoxSeries,
	type AnchoredTextOptions,
	type GroupedBarsData,
	type HeatMapData,
	type LollipopData,
	type VolumeProfileData,
	type WhiskerData,
} from '@effanuel/lightweight-plugins';

const DAY = 86_400;
const START = 1_704_067_200; // 2024-01-01T00:00:00Z
const BARS = 60;
const time = (i: number) => (START + i * DAY) as UTCTimestamp;
const wave = (i: number) => 50 + 30 * Math.sin(i / 6);

const lineData = Array.from({ length: BARS }, (_, i) => ({ time: time(i), value: wave(i) }));
const candleData = lineData.map(({ time, value }, i) => {
	const open = value - 3 * Math.cos(i);
	return { time, open, close: value, high: Math.max(open, value) + 2, low: Math.min(open, value) - 2 };
});

const charts: Record<string, IChartApi> = {};
// check.mjs needs the pane width to click next to the price scale.
Object.assign(window, { paneWidth: (name: string) => charts[name].paneSize().width });

function chartFor(name: string): IChartApi {
	const cell = document.createElement('section');
	cell.dataset.plugin = name;
	const title = document.createElement('h2');
	title.textContent = name;
	const host = document.createElement('div');
	host.className = 'chart';
	cell.append(title, host);
	document.getElementById('grid')!.append(cell);
	charts[name] = createChart(host, { autoSize: true });
	return charts[name];
}

function lineChart(name: string): { chart: IChartApi; series: ISeriesApi<'Line'> } {
	const chart = chartFor(name);
	const series = chart.addSeries(LineSeries, { color: '#2962FF' });
	series.setData(lineData);
	return { chart, series };
}

// --- primitives and tools (9) ---
{
	const { series } = lineChart('AnchoredText');
	const options: AnchoredTextOptions = {
		vertAlign: 'middle',
		horzAlign: 'middle',
		text: 'AnchoredText',
		lineHeight: 40,
		font: 'bold 32px sans-serif',
		color: 'rgba(200, 0, 200, 0.7)',
	};
	series.attachPrimitive(new AnchoredText(options));
}
{
	const { series } = lineChart('BandsIndicator');
	series.attachPrimitive(
		new BandsIndicator({ lineColor: 'rgb(0, 160, 80)', fillColor: 'rgba(0, 160, 80, 0.2)', lineWidth: 2 }),
	);
}
{
	const chart = chartFor('CrosshairHighlightPrimitive');
	const series = chart.addSeries(CandlestickSeries);
	series.setData(candleData);
	series.attachPrimitive(new CrosshairHighlightPrimitive({ color: 'rgba(255, 0, 255, 0.3)' }));
}
{
	const { series } = lineChart('OverlayPriceScale');
	series.attachPrimitive(new OverlayPriceScale({}));
}
{
	const { series } = lineChart('PartialPriceLine');
	series.attachPrimitive(new PartialPriceLine());
}
{
	const { series } = lineChart('SessionHighlighting');
	// Highlight weekends (UTC Saturday = 6, Sunday = 0).
	series.attachPrimitive(
		new SessionHighlighting(t =>
			new Date((t as UTCTimestamp) * 1000).getUTCDay() % 6 === 0 ? 'rgba(255, 152, 0, 0.35)' : 'rgba(0, 0, 0, 0)',
		),
	);
}
{
	const { chart, series } = lineChart('TrendLine');
	series.attachPrimitive(
		new TrendLine(
			chart,
			series,
			{ time: time(10), price: wave(10) },
			{ time: time(45), price: wave(45) },
			{ lineColor: 'rgb(220, 0, 0)', width: 3 },
		),
	);
}
{
	const { chart, series } = lineChart('UserPriceLines');
	new UserPriceLines(chart, series, { color: 'rgb(0, 150, 0)' });
}
{
	const { chart, series } = lineChart('VolumeProfile');
	const vp: VolumeProfileData = {
		time: time(20),
		width: 10,
		profile: Array.from({ length: 15 }, (_, i) => ({ price: 22 + i * 4, vol: 5 + ((i * 7) % 13) })),
	};
	series.attachPrimitive(new VolumeProfile(chart, series, vp));
}

// --- custom series (5) ---
{
	const chart = chartFor('BackgroundShadeSeries');
	chart.addCustomSeries(new BackgroundShadeSeries(), { lowValue: 20, highValue: 80 }).setData(lineData);
}
{
	const chart = chartFor('WhiskerBoxSeries');
	const data = lineData.map(
		({ time, value }): WhiskerData => ({ time, quartiles: [value - 20, value - 8, value, value + 8, value + 20] }),
	);
	chart.addCustomSeries(new WhiskerBoxSeries()).setData(data);
}
{
	const chart = chartFor('GroupedBarsSeries');
	const data = lineData.map(({ time, value }): GroupedBarsData => ({ time, values: [value, 100 - value, value / 2] }));
	chart.addCustomSeries(new GroupedBarsSeries()).setData(data);
}
{
	const chart = chartFor('HeatMapSeries');
	const data = lineData.map(
		({ time, value }): HeatMapData => ({
			time,
			cells: Array.from({ length: 10 }, (_, k) => ({
				low: k * 10,
				high: k * 10 + 10,
				amount: Math.max(0, 100 - Math.abs(value - k * 10 - 5) * 3),
			})),
		}),
	);
	chart.addCustomSeries(new HeatMapSeries()).setData(data);
}
{
	const chart = chartFor('LollipopSeries');
	const data = lineData.map(({ time, value }): LollipopData => ({ time, value }));
	chart.addCustomSeries(new LollipopSeries()).setData(data);
}
```

Run: `cd "$SP/consumer" && pnpm typecheck`
Expected: exits 0 with no output.

If errors point **only** into `node_modules/lightweight-charts/`, that library's own typings fail under `skipLibCheck: false`, which isn't ours to fix. Then add `"skipLibCheck": true`, rerun, and record that in the final report. Any error in `@effanuel/lightweight-plugins/dist/index.d.ts` (e.g. `Cannot find module 'fancy-canvas'`) is a real package bug: fix `packages/lightweight-plugins/package.json` and repack from Step 1.

- [ ] **Step 4: Tree-shaking check: importing one plugin must not pull in the others**

`$SP/consumer/treeshake.mjs`:

```js
import { TrendLine } from '@effanuel/lightweight-plugins';
console.log(TrendLine);
```

```bash
cd "$SP/consumer"
pnpm dlx esbuild treeshake.mjs --bundle --minify --format=esm --external:lightweight-charts --outfile=treeshake.out.js
wc -c < treeshake.out.js
grep -oE "_bandsData|vertAlign|quartiles" treeshake.out.js | sort | uniq -c ; echo "other-plugin markers: $?"
```

Expected: the size is roughly 2–4 KB (the spike measured 2.6 KB). The grep finds nothing, so the output ends with `other-plugin markers: 1`. (`_bandsData` is BandsIndicator's, `vertAlign` AnchoredText's, `quartiles` WhiskerBoxSeries'.)

- [ ] **Step 5: Build and serve the consumer page**

```bash
cd "$SP/consumer" && pnpm build
```

Expected: `vite build` succeeds and writes `dist/index.html` plus one JS asset.

Then start the preview server as a **background** command: `cd "$SP/consumer" && pnpm preview`. Expected: it serves on `http://localhost:4173/`.

- [ ] **Step 6: Write the headless-browser check**

```bash
mkdir -p "$SP/browser-check" && cd "$SP/browser-check"
echo '{ "name": "browser-check", "private": true, "type": "module" }' > package.json
npm i -q playwright@latest && npx playwright install chromium
```

`$SP/browser-check/check.mjs`:

```js
// Throwaway consumer check: screenshots each plugin's chart and fails on console/page errors.
// Expects `pnpm preview` of $SP/consumer on :4173.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PAGE_URL = process.env.PAGE_URL ?? 'http://localhost:4173/';
const EXPECTED_SECTIONS = 14;
const out = new URL('./out/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => {
	if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await page.goto(PAGE_URL);
await page.waitForFunction(
	n => document.querySelectorAll('section[data-plugin] canvas').length >= n * 2,
	EXPECTED_SECTIONS,
);
await page.waitForTimeout(500);

const names = await page.$$eval('section[data-plugin]', els => els.map(e => e.dataset.plugin));
for (const name of names) {
	const section = page.locator(`section[data-plugin="${name}"]`);
	const host = section.locator('.chart');
	await host.scrollIntoViewIfNeeded();
	const box = await host.boundingBox();
	if (name === 'UserPriceLines') {
		// Click just left of the price scale: that's the "+" button that adds a price line.
		const paneWidth = await page.evaluate(n => window.paneWidth(n), name);
		const x = box.x + paneWidth - 4;
		const y = box.y + box.height / 3;
		await page.mouse.move(x, y);
		await page.mouse.click(x, y);
		await page.mouse.move(x - 2, y + 1);
	} else {
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	}
	await page.waitForTimeout(150);
	await section.screenshot({ path: `${out}${name}.png` });
}
await browser.close();

console.log(`sections: ${names.length}`);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console/page errors');
if (names.length !== EXPECTED_SECTIONS || errors.length) process.exit(1);
```

- [ ] **Step 7: Run it and inspect every screenshot**

Run: `cd "$SP/browser-check" && node check.mjs`
Expected: `sections: 14` and `no console/page errors`, exit 0.

Open each `$SP/browser-check/out/<Export>.png` with the Read tool and confirm:

| Screenshot | Must show |
|---|---|
| `AnchoredText` | large magenta "AnchoredText" text centred over the blue line |
| `BandsIndicator` | green band lines with a translucent green fill around the blue line |
| `CrosshairHighlightPrimitive` | candles, plus a translucent magenta vertical band on the hovered bar |
| `OverlayPriceScale` | price labels drawn inside the pane, over the line |
| `PartialPriceLine` | a horizontal price line at the last value, spanning only part of the pane |
| `SessionHighlighting` | orange vertical stripes on weekend bars |
| `TrendLine` | a thick red line between two points on the wave |
| `UserPriceLines` | a dashed green horizontal price line (added by the click) and/or the "+" label near the price scale |
| `VolumeProfile` | horizontal volume bars anchored near the 20th bar |
| `BackgroundShadeSeries` | a background shaded from blue (low) to red (high) |
| `WhiskerBoxSeries` | box-and-whisker glyphs per bar |
| `GroupedBarsSeries` | groups of three coloured bars per time point |
| `HeatMapSeries` | green heatmap cells following the wave |
| `LollipopSeries` | stems with dots following the wave |

Any blank chart or missing plugin drawing is a failure: investigate with superpowers:systematic-debugging before going further.

- [ ] **Step 8: Repeat against the oldest peer, `lightweight-charts@5.0.0`**

```bash
npm view lightweight-charts versions --json | tr -d '[]" \n' | tr ',' '\n' | grep '^5\.' | head -20
cd "$SP/consumer" && pnpm add lightweight-charts@5.0.0 && pnpm typecheck && pnpm build
```

Restart the background `pnpm preview`, then run `cd "$SP/browser-check" && node check.mjs`. Expected: same as Step 7.

If 5.0.0 fails (type errors or runtime errors), find the lowest passing version by repeating with each later `5.x.0` from the list. Then set `"lightweight-charts": "^5.<that-minor>.0"` in `packages/lightweight-plugins/package.json` `peerDependencies` and the README's "`^5.0.0` is a peer dependency" line, rerun Task 1 Step 8 and Task 2 Step 7, and commit:

```bash
git add packages/lightweight-plugins/package.json packages/lightweight-plugins/README.md
git commit -m "fix: narrow lightweight-charts peer range to versions that work

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If 5.0.0 passes, change nothing.

- [ ] **Step 9: Stop the preview server and remove the tarball from the repo tree**

Stop the background `pnpm preview`. Then run `git status --short` in the worktree. Expected: clean. The tarball went to `$SP`, and `dist/` is gitignored.

---

### Task 4: Final verification and hand-off

**Files:** none changed (unless a check fails).

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: the branch ready to integrate.

- [ ] **Step 1: Run every check from a clean build**

```bash
rm -rf packages/lightweight-plugins/dist
pnpm build:plugins
pnpm -F @effanuel/lightweight-plugins test
(cd packages/lightweight-plugins && pnpm dlx publint && pnpm dlx @arethetypeswrong/cli --pack --profile esm-only)
pnpm lint
pnpm build
git status --short
```

Expected: build success, `smoke ok: 14 exports, lightweight-charts external`, publint with no errors, attw `No problems found 🌟`, lint with 0 errors, next build success, and a clean `git status`. Paste the real output into the final report.

- [ ] **Step 2: Hand off**

Use superpowers:finishing-a-development-branch. Offer merge-to-master + push, or a draft PR (user's standing preference). If the user picks a PR, run a code review after opening it and fix all HIGH findings before reporting done. Remind the user that publishing is theirs: `npm login`, then `pnpm -F @effanuel/lightweight-plugins publish`.
