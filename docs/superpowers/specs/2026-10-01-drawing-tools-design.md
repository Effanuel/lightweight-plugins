# Drawing tools package and showcase — design

Date: 2026-10-01 · Branch: `feat/drawing-tools`

## Goal

Replace the contents of `@vecordis/lightweight-plugins` with terminal-orderflow's
mouse-driven chart drawing tools, made framework-free, and rebuild the showcase
site around them. The 14 TradingView example plugins are removed.

Source of the ported code: `~/GitHub/terminal-orderflow/frontend/src/app/`
(React + zustand app). Terminal itself is not changed.

**Done when**
1. `pnpm -F @vecordis/lightweight-plugins test` passes: ported terminal tests, new
   `DrawingManager` tests, and the smoke check (now expecting the new exports).
2. `pnpm build:plugins` emits `dist/index.js` + `dist/index.d.ts` exporting
   `DrawingManager` and the public types below; no React or zustand in `dist/`.
3. On the site, a headless Chromium run creates one drawing with every tool by
   mouse, then exercises select + drag, Delete, Escape, undo/redo, marquee select
   and copy/paste, with no console errors, at 1280px; no horizontal scroll at
   1280, 1024 and 390px.
4. The app's `pnpm build` and `pnpm lint` pass.
5. Package version is `0.2.0`; its README documents the new API.

## Decisions (from the user)

- The package ships **interaction**, not just shapes: arm a tool, place by mouse,
  drag, select, delete. No React, no zustand.
- Tools: **horizontal line, horizontal ray, vertical line, trend line, box,
  Fibonacci, path, free draw, measure**.
- Extras: **undo/redo, copy/paste, marquee multi-select**. Not magnet snapping.
- **Remove** the 14 TradingView example plugins (breaking → 0.2.0).
- Site: **one big chart + toolbar + style bar**.
- Approach **A**: port terminal's primitives, helpers, per-tool configs and
  interaction harness nearly verbatim; replace its zustand stores with a plain
  store; expose one `DrawingManager` class. Migrating terminal onto the package
  is a later, separate project.

## Public API

```ts
import { DrawingManager } from '@vecordis/lightweight-plugins';

const drawings = new DrawingManager(chart, series, options?);
```

| Member | Behaviour |
|---|---|
| `constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, options?: { tickSize?: number; keyboard?: boolean })` | Attaches all tools to `series`. `tickSize` defaults to `series.options().priceFormat.minMove`, else `0.01`. `keyboard` defaults to `true`. |
| `setTool(tool: ToolName \| null)` / `getTool()` | Arms a tool or disarms (`null`). Emits `toolChange`. |
| `getDrawings(): Drawing[]` | Serializable snapshot of all drawings, each tagged with `kind`. Measurements are not drawings. |
| `setDrawings(list: Drawing[])` | Replaces all drawings; clears undo history; ids continue above the highest loaded id. Emits `change`. |
| `clear()` | Removes all drawings as one undo step. |
| `setHidden(hidden: boolean)` / `isHidden()` | Hides/shows all drawings without deleting them. |
| `getSelection(): Drawing[]` | Current selection (single or marquee). |
| `setStyle(patch: Partial<DrawingStyle & BoxStyle>)` | Restyles the selection as one undo step. Each drawing takes only the keys its style type has. |
| `setToolStyle(tool, patch)` | Style used for that tool's next drawings (terminal's "last used style"). |
| `deleteSelected()` | One undo step. |
| `undo()` / `redo()` → `boolean` | False when nothing was applied. |
| `copy()` / `paste()` | Copies the selection; pastes clones offset by 5% of the visible time and price span, as one undo step, and selects them. |
| `on(event, cb)` → `() => void` | Events: `change` (drawings added/updated/removed, undo/redo, `setDrawings`, `clear`), `toolChange`, `selectionChange`. Returns an unsubscribe function. |
| `destroy()` | Detaches primitives and removes every listener. |

`ToolName = 'select' | 'h-line' | 'h-ray' | 'v-line' | 'trend' | 'box' | 'fibonacci' | 'path' | 'free-draw' | 'measure'`

### Data model (exported types)

Times are bar timestamps (seconds), prices are numbers. Shapes are terminal's,
plus a `kind` tag:

| `kind` | Fields |
|---|---|
| `h-line` | `id, price, time, style: DrawingStyle` |
| `h-ray` | `id, price, time, style: DrawingStyle` |
| `v-line` | `id, time, price, style: DrawingStyle` |
| `trend` | `id, p1, p2, style: DrawingStyle` (`p = { time, price }`) |
| `box` | `id, p1, p2, style: BoxStyle` |
| `fibonacci` | `id, p1, p2, style: DrawingStyle, levels?: FibLevel[]` |
| `path` | `id, points: { time, price }[], hasArrow, style: DrawingStyle` |
| `free-draw` | `id, points: { time, price }[], style: DrawingStyle` |

- `DrawingStyle = { width, color, pattern: 'solid' | 'dashed' | 'dotted', opacity }`, default `{ 1, '#ffffff', 'solid', 1 }`.
- `BoxStyle = { borderColor, borderWidth, borderOpacity, bgColor, bgOpacity }`, default white border, width 1, opacity 1, bg `#2962ff` at 0.1.
- `FibLevel` and `DEFAULT_FIB_LEVELS` (0, 1, 1.618, 2.618, 4.618, 8.618) as in terminal. No level-editing API in this release.
- Ids are numbers, unique across kinds within a manager.

### Interaction (terminal's behaviour, unchanged)

- One click: `h-line`, `h-ray`, `v-line`. Two clicks: `trend`, `box`, `fibonacci`,
  `measure`. Path: click per point, finishes on a click near the previous point.
  Free draw: press, drag, release. A finished drawing is selected and the tool
  disarms. Prices snap to `tickSize`.
- Hover highlights; corner/handle hits win over body hits. Drag the body to move,
  drag a handle to reshape, Alt+drag to clone. The chart doesn't pan or zoom
  during a drawing drag.
- Marquee: Ctrl/Cmd+drag, or plain drag with the `select` tool.
- Keyboard (when `keyboard: true`), ignored while typing in an input:
  Delete/Backspace delete selection; Escape cancels creation, disarms, deselects;
  Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z and Ctrl+Y redo; Ctrl/Cmd+C/V copy/paste.
  Only the manager whose chart last received a mousedown reacts, so several
  charts on one page don't all respond.
- Undo history: 100 steps; a drag, a paste, a marquee delete and a `setStyle`
  are one step each.
- Right-click cancels an in-progress drag or disarms.

## Package internals

```
packages/lightweight-plugins/src/
  index.ts                  public exports
  drawing-manager.ts        DrawingManager: wiring, click routing, keyboard, events
  store/
    drawing-store.ts        new: items per kind, nextId, hidden, edit/undo grouping
    tool-state.ts           new: active tool, next-drawing styles
    drawing-history.ts      terminal lib/drawing-history.ts, verbatim
  harness/
    chart-plugin.ts         plugin/context types (pane & surface removed)
    drawing-tool-plugin.ts  terminal's harness; store reads go through the context
    chart-gesture.ts        verbatim
    drawing-gesture-geometry.ts  tick size + bars from the manager, not paneState
    drawing-hover.ts        hover arbiter, per manager instead of module-level
  tools/                    one file per tool: terminal hook's xxxConfig, no React
    horizontal-line.ts horizontal-ray.ts vertical-line.ts trend-line.ts box.ts
    fibonacci.ts path.ts free-draw.ts measure.ts marquee.ts
  primitives/               terminal plugins/*Primitive.ts + DrawingPrimitiveBase
    chart-drawing.ts        trimmed: order/badge helpers removed
  lib/
    drawing-geometry.ts drawing-style.ts fib-levels.ts marquee-select.ts
    drawing-clone.ts dom-events.ts
    drawing-clipboard.ts    per manager instead of module-level
    chart-measure.ts        pure half of terminal's; bars come from series.data()
```

- **Store seam.** Every `useDrawingsStore` / `useChartToolsStore` / `useChartStore`
  / `paneState` read in the ported code is replaced by the manager's
  `DrawingStore`, `ToolState`, `tickSize()` and `getBars()` (= `series.data()`).
  Terminal's symbol/interval reset subscription is dropped; `setDrawings` clears
  transient state instead.
- **Removed concepts.** `PaneId`, `DrawingSurface` (price/CVD), store buckets
  keyed by symbol/interval, persistence, the `vmedian` kind, soft magnet,
  `measure-pct`, merge-bars.
- **Chart elements.** The manager listens on `chart.chartElement()` and uses
  `chart.panes()[0].getHTMLElement()` for pane-relative coordinates.
- **Removed from the package.** All 14 TradingView plugins, `plugin-base.ts`,
  `helpers/`, and the root `eslint.config.mjs` "vendored" ignore for them.
- **Licence.** Stays Apache-2.0. `NOTICE` is deleted unless porting finds code
  copied from TradingView's plugin-examples (check `TrendLinePrimitive`,
  `VerticalLinePrimitive` and the axis-label helpers in `chart-drawing.ts`
  against upstream `v5.2.1`); any match keeps a NOTICE entry naming those files.
- **Build.** Unchanged: tsup, ESM only, `lightweight-charts` peer `^5.0.0`,
  `fancy-canvas` dependency. Version `0.2.0`.

## Tests

- Package gets `vitest` and `jsdom` dev dependencies; `test` runs vitest then
  `test/smoke.mjs`.
- Ported from terminal with imports adjusted: `chart-gesture`, `drawing-geometry`,
  `marquee-select`, `fib-levels`, `drawing-style`, `drawing-history`,
  `drawing-clipboard`, `drawing-clone`, `chart-drawing`,
  `drawing-gesture-geometry`, the HorizontalLine/TrendLine/VerticalLine primitive
  tests, and `drawing-tool-plugin.test.ts` adapted to `DrawingStore`.
- Store tests: `drawing-store` (CRUD, ids, hidden, edit grouping, undo/redo).
- New `DrawingManager` tests (jsdom): `setTool`/`toolChange`, `getDrawings` ↔
  `setDrawings` round trip, `setStyle` per-kind key filtering, `clear`/undo,
  copy/paste offset and selection, keyboard handled only by the last-clicked
  manager, `destroy` removes listeners.
- `smoke.mjs` asserts `DrawingManager` and `DEFAULT_FIB_LEVELS` are exported and
  importing the package needs no DOM.

## Site

- `/` is rebuilt; `src/showcase/demos.ts` and `PluginCard.tsx` are deleted;
  `sample-data.ts` keeps only what the page uses (seeded candles).
- **Header:** package name, "Drawing tools for TradingView Lightweight Charts v5",
  install command, npm and GitHub links.
- **Toolbar:** vertical strip left of the chart (a horizontal row above it below
  `md`): select, horizontal line, ray, vertical line, trend, box, Fibonacci, path,
  free draw, measure; then undo, redo, hide/show, clear. Icons ported from
  terminal's `components/tool-icons.tsx`; each button has a `title` with its
  shortcut where one exists, and the armed tool is highlighted.
- **Chart:** full width, `min(70vh, 640px)` tall, existing dark `ChartOptions`,
  seeded candlesticks. Seeded with one horizontal line, trend line, box and
  Fibonacci via `setDrawings` so the first view isn't empty.
- **Style bar** (under the chart, shown while something is selected): colour
  swatches (`color` and `borderColor`), width 1–4 (`width` and `borderWidth`),
  solid/dashed/dotted, fill swatches when a box is selected (`bgColor`), delete.
- **Below:** a short shortcut list and a collapsible usage snippet.
- The page sets `window.drawings` to its manager, for console experiments and
  for the browser check.
- On touch-only devices a note says drawing needs a mouse (terminal's interaction
  is mouse events only).
- No persistence: reload resets the chart.

## Verification

1. `pnpm -F @vecordis/lightweight-plugins test` and `pnpm build:plugins` pass.
2. `pnpm build` and `pnpm lint` pass.
3. Throwaway Playwright script (scratchpad, not committed) against `next start`:
   for each tool, click its toolbar button and perform its mouse gesture on the
   chart, asserting `window.drawings.getDrawings()` grows by one of the right
   `kind` (measure: no drawing, no error); then select + drag changes a
   drawing's price, Delete removes it, undo restores it, redo removes it again,
   Ctrl+drag marquee selects ≥ 2, Ctrl+C/Ctrl+V adds that many, Escape
   deselects. Zero console errors. No horizontal scroll at 1280, 1024, 390.
   Screenshots inspected by eye.
4. `git grep -nE "zustand|from \"react\"" packages/lightweight-plugins/src` is empty.

## Out of scope

- Changing terminal-orderflow, or making it consume the package.
- Touch/pointer-event drawing, magnet snapping, `measure-pct`, Fibonacci level
  editing UI or API, persistence helpers, multi-pane charts.
- Publishing to npm (the user publishes manually).
