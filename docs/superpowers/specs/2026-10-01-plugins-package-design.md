# Publishable plugins package — design

Date: 2026-10-01 · Branch: `feat/plugins-package`

## Goal

Turn this repo into a source of lightweight-charts plugins that other projects
install from npm and use with one import:

```ts
import { TrendLine, HeatMapSeries } from '@effanuel/lightweight-plugins';
```

The Next.js demo app keeps working and stays deployed on Vercel unchanged.

**Done when**
1. `pnpm build:plugins` emits `dist/index.js` and `dist/index.d.ts`.
2. `publint` and `@arethetypeswrong/cli --pack --profile esm-only` pass on the
   package.
3. `pnpm -F @effanuel/lightweight-plugins test` (Node smoke check) passes.
4. A packed tarball, installed into a blank Vite + TS page, type-checks and
   renders all 14 plugins in a headless browser with no console errors.
5. The app's `pnpm build` and `pnpm lint` still pass.

## Decisions (all from the user)

- Published **publicly on npm** as **`@effanuel/lightweight-plugins`**.
- **Contents:** the 14 plugins copied verbatim from TradingView's
  `plugin-examples` at tag `v5.2.1`. Excluded and kept app-only:
  `position-plugin/`, `plugins/utils/` (used only by position-plugin),
  `plugins/price-line.ts` (`PriceLinesManager`), and the orderflow /
  rounded-candles code in `src/app/orderflow/`.
- **Layout:** approach A — a pnpm workspace with the app staying at the repo
  root and the package in `packages/lightweight-plugins/`. A full monorepo
  (`apps/demo`) and a separate repo were rejected.
- **API:** a single root entry point, no per-plugin subpath exports.
- **Build:** tsup, ESM only.
- **Release:** manual publish by the user; no changesets or CI publishing yet.

## Package contents

These move with `git mv` (history kept, bytes unchanged) from the app into the
package, **preserving their relative layout** so every relative import
(`../../helpers/…`, `../plugin-base`) keeps resolving with no edits:

| From (app) | To (package) |
|---|---|
| `src/plugins/<plugin>/` × 14 | `packages/lightweight-plugins/src/plugins/<plugin>/` |
| `src/plugins/plugin-base.ts` | `packages/lightweight-plugins/src/plugins/plugin-base.ts` |
| `src/helpers/` (whole dir) | `packages/lightweight-plugins/src/helpers/` |

The 14 plugins:

| Dir | Kind | Main export |
|---|---|---|
| `anchored-text` | primitive | `AnchoredText` |
| `bands-indicator` | primitive | `BandsIndicator` |
| `highlight-bar-crosshair` | primitive | `CrosshairHighlightPrimitive` |
| `overlay-price-scale` | primitive | `OverlayPriceScale` |
| `partial-price-line` | primitive | `PartialPriceLine` |
| `session-highlighting` | primitive | `SessionHighlighting` |
| `trend-line` | primitive | `TrendLine` |
| `user-price-lines` | primitive-based tool | `UserPriceLines` |
| `volume-profile` | primitive | `VolumeProfile` |
| `background-shade-series` | custom series | `BackgroundShadeSeries` |
| `box-whisker-series` | custom series | `WhiskerBoxSeries` |
| `grouped-bars-series` | custom series | `GroupedBarsSeries` |
| `heatmap-series` | custom series | `HeatMapSeries` |
| `lollipop-series` | custom series | `LollipopSeries` |

Nothing in the app imports any moved file (verified with grep), so the app
needs no import changes. Sample-data files and the two upstream nested
`package.json` files (`anchored-text`, `background-shade-series`) move along
untouched; they are not exported and not in `files`.

## Public API — `src/index.ts`

The only hand-written source file. It uses explicit named exports, not
`export *`, because five plugins each export a `defaultOptions` and would
collide. Renderers, `defaultOptions`, `PluginBase` and helpers stay internal.

```ts
export { AnchoredText } from './plugins/anchored-text/anchored-text';

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

export { OverlayPriceScale, type OverlayPriceScaleOptions } from './plugins/overlay-price-scale/overlay-price-scale';

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

## Build & packaging

`packages/lightweight-plugins/package.json` follows TradingView's own
`@tradingview/lwc-plugin-*` packages (ESM, `lightweight-charts` as peer,
`fancy-canvas` as dependency):

```json
{
  "name": "@effanuel/lightweight-plugins",
  "version": "0.1.0",
  "description": "Plugins for TradingView lightweight-charts v5",
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist", "NOTICE"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Effanuel/lightweight-plugins.git",
    "directory": "packages/lightweight-plugins"
  },
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsup",
    "test": "node test/smoke.mjs",
    "prepublishOnly": "pnpm build"
  },
  "peerDependencies": { "lightweight-charts": "^5.0.0" },
  "dependencies": { "fancy-canvas": "~2.1.0" },
  "devDependencies": { "lightweight-charts": "^5.2.1", "tsup": "^8.5.1", "typescript": "~6.0.3" }
}
```

- **License** is Apache-2.0 because all shipped code derives from TradingView's
  Apache-2.0 code.
- **`fancy-canvas`** is a runtime dependency because the emitted `.d.ts`
  references its types (renderers' `draw(target: CanvasRenderingTarget2D)`).
- **`tsup.config.ts`:** `entry: ['src/index.ts']`, `format: ['esm']`,
  `dts: true`, `sourcemap: true`, `clean: true`, no minify (consumers minify).
  Bundling also resolves the sources' extensionless relative imports, so the
  output works under plain Node ESM (SSR, vitest), not just bundlers.
- **`packages/lightweight-plugins/tsconfig.json`:** `strict`,
  `moduleResolution: "bundler"`, `module: "esnext"`, `target: "ES2020"`,
  `lib: ["dom", "esnext"]`, `skipLibCheck`, `noEmit` (tsup emits),
  `include: ["src"]`.
- `.gitignore` gets `packages/*/dist`.

### Root changes

- New `pnpm-workspace.yaml`: `packages: ['packages/*']`. The root stays a
  workspace project.
- `tsconfig.json`: add `"packages"` to `exclude`, so Next's type check skips the
  package and its `dist/`.
- `eslint.config.mjs`: repoint the `vendored` ignore list to
  `packages/lightweight-plugins/src/plugins/<plugin>/**`,
  `packages/lightweight-plugins/src/plugins/plugin-base.ts` and
  `packages/lightweight-plugins/src/helpers/**`; ignore `packages/*/dist/**`.
  `src/index.ts` stays linted.
- `package.json`: add the script
  `"build:plugins": "pnpm -F @effanuel/lightweight-plugins build"`. The app
  does **not** depend on the package, since it imports none of these plugins.
- Vercel: unaffected. The app stays at the root; `pnpm install` also installs
  the package's devDependencies, and `next build` never touches the package.

## Licensing, attribution & docs

The package directory ships:

- **`LICENSE`**: the Apache-2.0 text from `tradingview/lightweight-charts` at tag
  `v5.2.1`.
- **`NOTICE`**: upstream's NOTICE verbatim (required by Apache-2.0 §4(d)):
  ```
  TradingView Lightweight Charts™
  Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/
  ```
  followed by: "This package includes plugin code from
  tradingview/lightweight-charts `plugin-examples` at tag v5.2.1, unmodified
  apart from file location."
- No per-file change notices are needed: the files are byte-identical, so
  §4(b) does not apply.
- **`README.md`**:
  - Install: `pnpm add @effanuel/lightweight-plugins lightweight-charts`
    (`lightweight-charts` ^5 is a peer).
  - A table of the 14 plugins (name, kind, one-line description, link to the
    upstream example source/demo).
  - Two snippets: attaching a primitive
    (`series.attachPrimitive(new TrendLine(chart, series, p1, p2))`) and adding
    a custom series (`chart.addCustomSeries(new HeatMapSeries(), options)`).
  - Attribution to TradingView and the Apache-2.0 license.
- Root `README.md`: one line pointing to the package.

Skipped: a usage snippet per plugin (the upstream demos already show each).
Add them if users ask.

## Verification

1. `pnpm build:plugins` emits `dist/index.js`, `dist/index.d.ts` and the
   sourcemap.
2. From the package dir, `pnpm dlx publint` and
   `pnpm dlx @arethetypeswrong/cli --pack --profile esm-only` both pass. They
   catch broken `exports`, `types` or `files`, and add no devDependencies.
3. **Smoke check (committed):** `packages/lightweight-plugins/test/smoke.mjs`
   imports `../dist/index.js` in Node and asserts that each of the 14 exported
   classes is a function. `lightweight-charts` 5 imports cleanly in Node
   without a DOM (checked: `createChart` resolves), so no stubs are needed.
4. **Real-consumer check (throwaway, in the scratchpad, not committed):**
   `pnpm pack` the package, then install the tarball plus `lightweight-charts`
   into a blank Vite + TS page. The page creates a chart, attaches the 9
   primitives/tools and adds the 5 custom series, using upstream sample data
   where needed. `tsc --noEmit` passes, and a headless-browser screenshot shows
   every plugin drawn with no console errors.
5. The app's `pnpm build` and `pnpm lint` still pass.

No unit-test suites: the code is verbatim upstream, so suites would re-test
TradingView. Add them when a plugin here is forked and changed.

## Release

- The user publishes, since it needs their npm credentials and is
  outward-facing: `npm login` once, then
  `pnpm -F @effanuel/lightweight-plugins publish`. `prepublishOnly` builds
  first, and `publishConfig.access` makes the scoped package public.
- Versions are bumped by hand; the first release is `0.1.0`.
- Skipped: changesets and a CI publish workflow with npm provenance. Add them
  once releases are frequent.

## Git

Work happens in a worktree on `feat/plugins-package` off master. When it's
done, offer merge-to-master + push, or a draft PR.
