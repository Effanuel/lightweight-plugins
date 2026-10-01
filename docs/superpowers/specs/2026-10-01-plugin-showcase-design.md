# Plugin showcase home page — design

Date: 2026-10-01 · Branch: `feat/plugin-showcase`

## Goal

Replace the home page (`/`, currently a live MEXC chart with the position tool)
with a showcase of the 14 plugins in `@vecordis/lightweight-plugins`, aimed at
developers deciding whether to install the package. Remove the position tool,
the rounded-candles/orderflow page and everything only they or the live chart
use.

**Done when**
1. `/` shows a header and 14 cards, one per package export, each rendering a
   live chart with its plugin.
2. `/orderflow` no longer exists; `/cvd` still works.
3. `pnpm build` and `pnpm lint` pass.
4. A headless Chromium check of `/` at 1280px and 390px wide finds 14 cards,
   a `<canvas>` in each, and no console errors; screenshots look right.

## Decisions (from the user)

- The live MEXC chart is **removed**, not moved.
- Showcase covers **only the 14 package plugins**.
- Layout is a **card grid**.
- Position tool and rounded candles are **deleted**.

## Deletions

| What | Paths |
|---|---|
| Position tool | `src/plugins/` (whole dir: `position-plugin/`, `utils/`, `price-line.ts`), `src/hooks/usePositionPlugin.ts`, `assets/position-plugin.png` |
| Rounded candles | `src/app/orderflow/` (whole dir) |
| Live chart | `src/components/Chart/Chart.tsx`, `src/components/LoadingOverlayWrapper.tsx`, `src/components/LoadingIndicator/`, `src/components/ui/custom-select.tsx` |
| MEXC + websocket plumbing | `src/context/ChartContext.tsx`, `src/context/WebSocketContext.tsx`, `src/workers/`, `src/services/mexcApi.ts`, `src/app/api/mexc/`, `src/hooks/useMexcData.ts`, `src/hooks/useSymbols.ts` |
| Root deps no longer imported | `swr`, `react-window`, `worker-loader`, `fancy-canvas`, `@tradingview/lwc-plugin-*` (7) |

`layout.tsx` drops `WebSocketProvider` and `ChartProvider`.

Kept: `/cvd` and everything it uses, including
`src/components/Chart/chart-options.ts`. Already-dead `src/components/OrderPanel/`
and `src/data.ts` are out of scope and stay.

## Page

**Header:** package name, one-line description, `pnpm add
@vecordis/lightweight-plugins lightweight-charts`, links to npm and to the
package on GitHub.

**Grid:** Tailwind grid, 1 column by default, 2 at `md`, 3 at `lg`. Cards in
the package README table's order (primitives and the tool A–Z, then custom
series).

**Card:**
- Name and a kind badge: `primitive`, `tool` (`UserPriceLines`) or
  `custom series`.
- One-line description, from the package README table. `UserPriceLines` and
  `CrosshairHighlightPrimitive` descriptions say what to hover or click.
- Chart, ~260px tall, using the app's existing dark `ChartOptions`.
- `<details>` with a short usage snippet (import, construct, attach / add
  series). Plain `<pre>`, no syntax highlighting.
- Link to the plugin's upstream source at lightweight-charts `v5.2.1`.

If a demo's `setup` throws, that card shows the error message in place of the
chart and logs it with `console.error`; other cards are unaffected.

## Demos

Each demo's `setup` is ported from TradingView's upstream example for that
plugin, with colours adjusted for the dark background (several defaults, e.g.
`TrendLine`'s black line, are invisible on it).

| Export | Base series | Shows |
|---|---|---|
| `AnchoredText` | line | text anchored in the pane |
| `BandsIndicator` | line | bands and fill around the line |
| `CrosshairHighlightPrimitive` | candlestick | bar under the cursor highlighted |
| `OverlayPriceScale` | line | overlay scale inside the pane |
| `PartialPriceLine` | line | partial last-value line; `rightOffset` set |
| `SessionHighlighting` | candlestick | background coloured by a `time` callback |
| `TrendLine` | line | line between two points, with labels |
| `UserPriceLines` | line | hover the price scale, click `+` |
| `VolumeProfile` | candlestick | volume-at-price histogram at one time |
| `BackgroundShadeSeries` | custom + line | shaded background by value |
| `WhiskerBoxSeries` | custom | box-and-whisker per bar |
| `GroupedBarsSeries` | custom | 3 bars per time point |
| `HeatMapSeries` | custom | heatmap cells per bar |
| `LollipopSeries` | custom | stem and dot per value |

Sample data is generated from a seeded PRNG so the page renders the same on
every load: a daily random walk (line and OHLC) plus small generators for
heatmap, whisker, grouped bars, lollipop and volume profile data.

## Files

| File | Purpose |
|---|---|
| `src/app/page.tsx` | Client page: header + grid of `PluginCard`s over `demos` |
| `src/showcase/demos.ts` | 14 entries: `{ name, kind, description, code, sourceUrl, setup(chart) }` |
| `src/showcase/sample-data.ts` | Seeded generators |
| `src/showcase/PluginCard.tsx` | Client: creates chart in `useEffect`, runs `setup`, removes chart on unmount |

`setup` is a function, so cards are rendered from a client component; the
page is `"use client"`. `metadata` stays in `layout.tsx`, with its description
updated to the package description.

## Wiring

- Root `package.json` adds `"@vecordis/lightweight-plugins": "workspace:*"`,
  so the showcase always matches the package source.
- The package exports only `dist/`, so `dev` and `build` run
  `pnpm build:plugins` first:
  `"dev": "pnpm build:plugins && next dev --turbopack"`,
  `"build": "pnpm build:plugins && next build"`.
  Vercel's Next.js preset runs the `build` script, so the deploy needs no
  config change.
- Root `README.md` is rewritten: what the repo is (the package + its showcase
  site), link to the deployed site and the package, run instructions. The
  position-plugin title and screenshot go.

## Verification

No app test framework exists and adding one is out of scope. Checks:

1. `pnpm build` and `pnpm lint` pass.
2. A throwaway Playwright script (scratchpad, not committed) loads `/` from
   `pnpm start` at 1280px and 390px, asserts 14 cards each containing a
   `<canvas>`, asserts no console errors, and saves screenshots that get
   inspected by eye.
3. `/cvd` loads; `/orderflow` returns 404.
