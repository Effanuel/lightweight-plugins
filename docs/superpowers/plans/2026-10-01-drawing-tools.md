# Drawing Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@vecordis/lightweight-plugins`' contents with terminal-orderflow's mouse-driven drawing tools behind one framework-free `DrawingManager`, and rebuild the showcase site around them.

**Architecture:** Port terminal's primitives, pure helpers, interaction harness and per-tool configs nearly verbatim into `packages/lightweight-plugins/src/`. Every zustand/app-store read goes through a `ToolEnv` (a plain `DrawingStore` + `ToolState` + tick size + per-manager hover arbiter + keyboard gate), and chart-wide lookups (bars, tick size) go through a `registerChartEnv` registry in `chart-measure`. `DrawingManager` wires tools to one chart/series and is the only public class. New code lands alongside the old TradingView plugins; the last task switches the site and deletes the old plugins, so every commit builds.

**Tech Stack:** TypeScript, lightweight-charts 5.2 (peer `^5.0.0`), fancy-canvas, tsup (ESM), vitest + jsdom (package tests), Next.js 16 / React 19 / Tailwind v4 (site), Playwright (scratchpad only).

**Spec:** `docs/superpowers/specs/2026-10-01-drawing-tools-design.md`

**Working directory:** worktree `/home/vecordis/GitHub/lightweight-plugins-drawings`, branch `feat/drawing-tools`. Paths are relative to it unless absolute. Shorthands used in commands:

```bash
T=/home/vecordis/GitHub/terminal-orderflow/frontend/src/app   # source (read-only)
P=packages/lightweight-plugins/src                             # destination
SCRATCH=/tmp/claude-1000/-home-vecordis-GitHub-lightweight-plugins/6ed9957d-b624-4877-a751-e474017dd25e/scratchpad
```

## Global Constraints

- Terminal-orderflow is read-only: copy from it, never edit it.
- No React and no zustand anywhere under `packages/lightweight-plugins/src`.
- Package: name `@vecordis/lightweight-plugins`, ESM only, `lightweight-charts` peer `^5.0.0`, `fancy-canvas` dependency, version `0.2.0` (Task 8).
- Drawing times are numeric bar timestamps (UTCTimestamp seconds); bars are read from `series.data()` and items without a numeric `time` are ignored.
- Public kinds and tool names exactly: `'h-line' | 'h-ray' | 'v-line' | 'trend' | 'box' | 'fibonacci' | 'path' | 'free-draw'`; tools add `'select' | 'measure'`.
- Defaults: `DrawingStyle {width:1, color:'#ffffff', pattern:'solid', opacity:1}`; `BoxStyle {borderColor:'#ffffff', borderWidth:1, borderOpacity:1, bgColor:'#2962ff', bgOpacity:0.1}`; undo limit 100; paste offset 5% of visible time/price span.
- Not in scope: magnet snapping, `measure-pct`, merge-bars, vmedian, panes/surfaces, persistence, touch input, Fibonacci level editing.
- Ported files keep terminal's formatting (2-space indent, double quotes, semicolons); new files follow it.
- Stage files by explicit path only (`git rm` for deletions). Never `git add -A`, `git add .`, `git commit -a`.
- Commit messages: conventional commits, last line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Package tests: `pnpm -F @vecordis/lightweight-plugins exec vitest run` (unit) and `pnpm -F @vecordis/lightweight-plugins test` (vitest + build smoke, from Task 7 on).

## Port Recipe

Every file copied from `$T` gets exactly these transformations; tasks list only what is extra.

**R1 — imports.** Replace each `@/app/...` import with a relative import per this table (path relative to the importing file):

| terminal module | package module |
|---|---|
| `@/app/plugins/DrawingPrimitiveBase`, `@/app/plugins/<Name>Primitive`, `@/app/plugins/chart-drawing` | `primitives/<same>` |
| `@/app/lib/chart-plugin`, `drawing-tool-plugin`, `chart-gesture`, `drawing-gesture-geometry`, `drawing-hover` | `harness/<same>` |
| `@/app/lib/drawing-history` | `store/drawing-history` |
| `@/app/lib/chart-measure`, `drawing-geometry`, `drawing-style`, `fib-levels`, `marquee-select`, `drawing-clone`, `drawing-clipboard`, `dom-events` | `lib/<same>` |
| `@/app/stores/drawings-store` — types/constants `BoxData BoxStyle DEFAULT_BOX_STYLE FibData DrawingKind DRAWING_KINDS DrawingDataMap DrawingsBucket` | `model` |
| `@/app/hooks/use<Tool>Plugin` (its `xxxConfig`) | `tools/<tool-file>` |

**R2 — drop vmedian.** Delete every `vmedian` / `VMedianData` / `VolumeMedianPrimitive` reference.

**R3 — drop panes/surfaces.** Delete `PaneId`, `DrawingSurface`, `usePaneId`, `paneId` and `surface` parameters, fields and arguments.

**R4 — store reads go through `env: ToolEnv`** (defined in Task 5, `harness/chart-plugin.ts`):

| terminal | package |
|---|---|
| `useDrawingsStore.getState().slice(kind, paneId, surface)` | `env.drawings.slice(kind)` |
| `useDrawingsStore.getState().generateId()` / `store.generateId()` | `env.drawings.generateId()` |
| `useDrawingsStore.getState().items(kind, paneId)` | `env.drawings.items(kind)` |
| `.add(kind, paneId, item)` / `.update(kind, paneId, id, patch)` / `.remove(kind, paneId, id)` | `.add(kind, item)` / `.update(kind, id, patch)` / `.remove(kind, id)` |
| `.edit(paneId, fn, mergeKey?)` / `.beginEdit(paneId)` / `.endEdit(paneId)` | `.edit(fn, mergeKey?)` / `.beginEdit()` / `.endEdit()` |
| `useDrawingsStore.getState().hidden` | `env.drawings.isHidden()` |
| `useDrawingsStore.subscribe(fn)` | `env.drawings.subscribe(fn)` (same `(state, prev)` signature) |
| `useChartToolsStore.getState().activeTool` / `.clearTool()` | `env.tools.activeTool` / `env.tools.clearTool()` |
| `useChartToolsStore.getState().getLastUsedStyle(slot)` / `setLastUsedStyle(slot, p)` | `env.tools.getLastUsedStyle(slot)` / `env.tools.setLastUsedStyle(slot, p)` |
| `useChartToolsStore.getState().getLastUsedBoxStyle()` / `setLastUsedBoxStyle(p)` | `env.tools.getLastUsedBoxStyle()` / `env.tools.setLastUsedBoxStyle(p)` |
| `useChartToolsStore.getState().fibLevels` | `env.tools.fibLevels` |
| `paneState(paneId).activeInstrument?.tickSize ?? 0.01` | `env.tickSize()` |
| `reportHover(...)` (module function) | `env.reportHover(...)` |
| `useChartStore.subscribe(...)` symbol/interval resets, `shouldResetOnChartChange` | delete |

**R5 — tests.** Same R1–R4 on test files. Store setup becomes a fresh env per test: replace `useDrawingsStore.setState({ buckets: {}, nextId: 1, hidden: false })` and `resetDrawingHistory()` with `env = makeEnv()` (Task 5 fixture); `useChartToolsStore.setState({ activeTool: X })` with `env.tools.setActiveTool(X)`; delete tests that exercise split panes, CVD surfaces, symbol/interval resets, soft magnet or vmedian. Do not weaken any other assertion.

## Review Focus

1. **Two charts on one page:** keyboard shortcuts, hover and clipboard must act only on the chart last clicked → Task 7 test `two managers: keys go only to the last-clicked chart`.
2. **Bad `setDrawings` input** (unknown kind, duplicate or non-integer id): throw a clear `Error` and leave the current drawings untouched → Task 7 tests `setDrawings rejects …`.
3. **Series data arriving after the manager is built** (live charts call `setData`/`update` later): times must resolve against current bars → Task 7 test `bars follow series data changes`.
4. **`destroy()`**: no listener survives — keyboard, mouse and chart click do nothing afterwards → Task 7 test `destroy removes every listener`.
5. **Tick size from the series' price format** (`minMove: 0.25`): placed prices land on that grid → Task 7 test `tickSize defaults to the series minMove`.

---

### Task 1: Test setup, model and pure helpers

**Files:**
- Modify: `packages/lightweight-plugins/package.json` (devDependencies, scripts)
- Create: `packages/lightweight-plugins/vitest.config.ts`
- Create: `$P/model.ts`
- Create (verbatim port + R1): `$P/lib/drawing-geometry.ts`, `$P/lib/drawing-style.ts`, `$P/lib/fib-levels.ts`, `$P/lib/marquee-select.ts`, `$P/lib/dom-events.ts`, `$P/harness/chart-gesture.ts`, `$P/store/drawing-history.ts`
- Test (port + R5): `$P/lib/drawing-geometry.test.ts`, `$P/lib/drawing-style.test.ts`, `$P/lib/fib-levels.test.ts`, `$P/lib/marquee-select.test.ts`, `$P/harness/chart-gesture.test.ts`, `$P/store/drawing-history.test.ts`

**Interfaces:**
- Produces `model.ts`: `BoxStyle`, `DEFAULT_BOX_STYLE`, `BoxData`, `FibData`, `DrawingKind` (`"box" | "path" | "freedraw" | "fib" | "ray" | "trend" | "hline" | "vline"`), `DRAWING_KINDS`, `DrawingDataMap`, `DrawingsBucket`, `emptyBucket(): DrawingsBucket`. Primitive data types are imported type-only from `primitives/*` (created in Task 3; type-only imports of not-yet-existing files are fine because Task 1's tests don't import `model.ts`).
- Produces the pure modules with terminal's exact exports.

- [ ] **Step 1: Add vitest**

```bash
pnpm -F @vecordis/lightweight-plugins add -D vitest jsdom
```

Create `packages/lightweight-plugins/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

// Node by default, like terminal; DOM tests opt in with `// @vitest-environment jsdom`.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
```

In `packages/lightweight-plugins/package.json` `scripts`, change `"test": "node test/smoke.mjs"` to:

```json
    "test": "vitest run && node test/smoke.mjs",
```

- [ ] **Step 2: Copy the pure modules and their tests (they fail to run until copied)**

```bash
mkdir -p $P/lib $P/harness $P/store
for f in drawing-geometry drawing-style fib-levels marquee-select; do cp $T/lib/$f.ts $T/lib/$f.test.ts $P/lib/; done
cp $T/lib/dom-events.ts $P/lib/
cp $T/lib/chart-gesture.ts $T/lib/chart-gesture.test.ts $P/harness/
cp $T/lib/drawing-history.ts $T/lib/drawing-history.test.ts $P/store/
grep -rn '@/app' $P/lib $P/harness $P/store
```

Apply R1 to every hit the grep prints (in these files the hits are self-imports such as `@/app/lib/drawing-geometry` → `./drawing-geometry`, plus `drawing-history.test.ts`'s `@/app/stores/drawings-store` import).

`drawing-history.test.ts` imports from the drawings store; open it and change that import to `../model`. If it uses anything `model.ts` does not export (see Step 3), inline the literal it needs in the test.

- [ ] **Step 3: Write `$P/model.ts`**

```ts
import type { DrawingStyle } from "./lib/drawing-style";
import type { FibLevel } from "./lib/fib-levels";
import type { RayData } from "./primitives/HorizontalRayPrimitive";
import type { PathData } from "./primitives/PathToolPrimitive";
import type { FreeStrokeData } from "./primitives/FreeDrawPrimitive";
import type { TrendData } from "./primitives/TrendLinePrimitive";
import type { HLineData } from "./primitives/HorizontalLinePrimitive";
import type { VLineData } from "./primitives/VerticalLinePrimitive";

export type BoxStyle = {
  borderColor: string;
  borderWidth: number;
  borderOpacity: number;
  bgColor: string;
  bgOpacity: number;
};

export const DEFAULT_BOX_STYLE: BoxStyle = {
  borderColor: "#ffffff",
  borderWidth: 1,
  borderOpacity: 1,
  bgColor: "#2962ff",
  bgOpacity: 0.1,
};

export type BoxData = {
  id: number;
  p1: { price: number; time: number };
  p2: { price: number; time: number };
  style: BoxStyle;
};

export type FibData = {
  id: number;
  p1: { price: number; time: number };
  p2: { price: number; time: number };
  style: DrawingStyle;
  /** Per-drawing level override. Unset draws DEFAULT_FIB_LEVELS. */
  levels?: FibLevel[];
};

export type DrawingKind = "box" | "path" | "freedraw" | "fib" | "ray" | "trend" | "hline" | "vline";

export const DRAWING_KINDS = ["box", "path", "freedraw", "fib", "ray", "trend", "hline", "vline"] as const;

export type DrawingDataMap = {
  box: BoxData;
  path: PathData;
  freedraw: FreeStrokeData;
  fib: FibData;
  ray: RayData;
  trend: TrendData;
  hline: HLineData;
  vline: VLineData;
};

export type DrawingsBucket = { [K in DrawingKind]: DrawingDataMap[K][] };

export const emptyBucket = (): DrawingsBucket =>
  Object.fromEntries(DRAWING_KINDS.map((k) => [k, []])) as unknown as DrawingsBucket;
```

- [ ] **Step 4: Run the ported tests**

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/lib src/harness src/store`
Expected: all ported test files pass (counts as in terminal; `chart-gesture.test.ts` alone has dozens of cases). Any failure is a missed R1 rewrite, not a behaviour change — fix the import.

- [ ] **Step 5: Commit**

```bash
git add packages/lightweight-plugins/package.json packages/lightweight-plugins/vitest.config.ts pnpm-lock.yaml \
  $P/model.ts $P/lib/drawing-geometry.ts $P/lib/drawing-geometry.test.ts $P/lib/drawing-style.ts $P/lib/drawing-style.test.ts \
  $P/lib/fib-levels.ts $P/lib/fib-levels.test.ts $P/lib/marquee-select.ts $P/lib/marquee-select.test.ts $P/lib/dom-events.ts \
  $P/harness/chart-gesture.ts $P/harness/chart-gesture.test.ts $P/store/drawing-history.ts $P/store/drawing-history.test.ts
git commit -m "feat(plugins): vitest, drawing model and pure helpers from terminal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Chart helpers behind a registry; per-manager hover and clipboard

**Files:**
- Create (port + edits): `$P/lib/chart-measure.ts`, `$P/lib/drawing-clone.ts`
- Create (new): `$P/harness/drawing-gesture-geometry.ts`, `$P/harness/drawing-hover.ts`, `$P/lib/drawing-clipboard.ts`
- Test: `$P/lib/chart-measure.test.ts` (new), `$P/harness/drawing-gesture-geometry.test.ts` (new), `$P/harness/drawing-hover.test.ts` (new), `$P/lib/drawing-clipboard.test.ts` (port, rewritten calls), `$P/lib/drawing-clone.test.ts` (port + R5)

**Interfaces:**
- Consumes: Task 1 `model.ts`, `drawing-geometry`, `drawing-style`.
- Produces:
  - `chart-measure.ts`: terminal's exports minus the magnet ones, plus `registerChartEnv(chart: IChartApi, env: ChartEnv): () => void` with `ChartEnv = { getBars(): readonly { time: number }[]; tickSize(): number }`. `timeAtX`, `timeToCoordinateOrNearest`, `computeMeasurement` read bars/tick size from it.
  - `drawing-gesture-geometry.ts`: `DrawingSample` (unchanged), `createDrawingGeometry(ctx: ChartPluginContext, tickSize: () => number): ChartGeometry<DrawingSample>`.
  - `drawing-hover.ts`: `HoverPrecision`, `ReportHover = (setHovered: (id: number | null) => void, id: number | null, precision?: HoverPrecision) => void`, `createHoverArbiter(): ReportHover`.
  - `drawing-clipboard.ts`: `DrawingSelection`, `emptySelection()`, `createClipboard(): { set(sel: DrawingSelection): void; get(): DrawingSelection | null; has(): boolean }`.
  - `drawing-clone.ts`: terminal's exports minus `cloneVMedian`; `CLONE_BY_KIND` over the 8 kinds; `offsetFromVisibleRange(ctx: Pick<ChartPluginContext, "chart" | "series" | "container">)`.
- Note: `ChartPluginContext` is defined in Task 5. Until then, `drawing-gesture-geometry.ts` and `drawing-clone.ts` import its type from `../harness/chart-plugin`; create that file now with the exact content from Task 5 Step 1 (it is types only) and commit it here.

- [ ] **Step 1: Write the failing tests**

`$P/lib/chart-measure.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { IChartApi } from "lightweight-charts";
import { computeMeasurement, registerChartEnv, timeAtX, timeToCoordinateOrNearest } from "./chart-measure";

function fakeChart(): IChartApi {
  return {
    timeScale: () => ({
      coordinateToLogical: (x: number) => x,
      timeToCoordinate: (t: number) => (t % 10 === 0 && t <= 20 ? t / 10 : null),
    }),
  } as unknown as IChartApi;
}

describe("chart env registry", () => {
  test("timeAtX reads the registered bars and extrapolates past them", () => {
    const chart = fakeChart();
    registerChartEnv(chart, { getBars: () => [{ time: 0 }, { time: 10 }, { time: 20 }], tickSize: () => 1 });
    expect(timeAtX(chart, 1)).toBe(10);
    expect(timeAtX(chart, 5)).toBe(50);
  });

  test("an unregistered chart has no bars, so times don't resolve", () => {
    expect(timeAtX(fakeChart(), 1)).toBeNull();
  });

  test("unregister removes the env", () => {
    const chart = fakeChart();
    const off = registerChartEnv(chart, { getBars: () => [{ time: 0 }, { time: 10 }], tickSize: () => 1 });
    off();
    expect(timeAtX(chart, 1)).toBeNull();
  });

  test("timeToCoordinateOrNearest extrapolates beyond the last bar", () => {
    const chart = fakeChart();
    registerChartEnv(chart, { getBars: () => [{ time: 0 }, { time: 10 }, { time: 20 }], tickSize: () => 1 });
    expect(timeToCoordinateOrNearest(chart, 40)).toBe(4);
  });

  test("computeMeasurement uses the registered tick size and bar interval", () => {
    const chart = fakeChart();
    registerChartEnv(chart, { getBars: () => [{ time: 0 }, { time: 60 }], tickSize: () => 0.25 });
    const m = computeMeasurement(chart, { price: 100, time: 0 }, { price: 101, time: 86400 * 2 });
    expect(m.priceDiff).toBe(1);
    expect(m.points).toBe(4);
    expect(m.bars).toBe(2880);
    expect(m.days).toBe(2);
    expect(m.tickSize).toBe(0.25);
  });
});
```

`$P/harness/drawing-gesture-geometry.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import type { IChartApi } from "lightweight-charts";
import { createDrawingGeometry } from "./drawing-gesture-geometry";
import { registerChartEnv } from "../lib/chart-measure";
import type { ChartPluginContext } from "./chart-plugin";

function ctx(): ChartPluginContext {
  const chart = {
    applyOptions: vi.fn(),
    timeScale: () => ({ width: () => 800, coordinateToLogical: (x: number) => x }),
  } as unknown as IChartApi;
  registerChartEnv(chart, { getBars: () => [{ time: 0 }, { time: 10 }], tickSize: () => 0.25 });
  const container = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 400 }),
  } as unknown as HTMLDivElement;
  return { chart, series: { priceToCoordinate: (p) => p, coordinateToPrice: (c) => c + 0.1 }, container };
}

describe("createDrawingGeometry", () => {
  test("sampleAt snaps both prices to the tick and has no magnet", () => {
    const g = createDrawingGeometry(ctx(), () => 0.25);
    expect(g.sampleAt(30, 50)).toEqual({ x: 30, y: 50, time: 300, rawPrice: 50, magnetPrice: 50 });
  });

  test("paneCoords rejects the price axis and points outside the pane", () => {
    const g = createDrawingGeometry(ctx(), () => 0.25);
    const at = (x: number, y: number) => ({ clientX: x, clientY: y }) as MouseEvent;
    expect(g.paneCoords(at(10, 10))).toEqual({ x: 10, y: 10 });
    expect(g.paneCoords(at(850, 10))).toBeNull();
    expect(g.paneCoords(at(10, 450))).toBeNull();
  });

  test("lockScroll toggles chart scroll and scale", () => {
    const c = ctx();
    createDrawingGeometry(c, () => 1).lockScroll(true);
    expect(c.chart.applyOptions).toHaveBeenCalledWith({ handleScroll: false, handleScale: false });
  });
});
```

`$P/harness/drawing-hover.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { createHoverArbiter } from "./drawing-hover";

const tick = () => new Promise<void>((r) => queueMicrotask(r));

describe("hover arbiter", () => {
  test("a corner hit beats a body hit with a higher id", async () => {
    const report = createHoverArbiter();
    const seen: Record<string, number | null> = {};
    report((id) => (seen.a = id), 1, "corner");
    report((id) => (seen.b = id), 9, "body");
    await tick();
    expect(seen).toEqual({ a: 1, b: null });
  });

  test("two arbiters never resolve each other's candidates", async () => {
    const one = createHoverArbiter();
    const two = createHoverArbiter();
    const seen: Record<string, number | null> = {};
    one((id) => (seen.a = id), 1, "body");
    two((id) => (seen.b = id), 2, "body");
    await tick();
    expect(seen).toEqual({ a: 1, b: 2 });
  });
});
```

Port `$T/lib/drawing-clipboard.test.ts` to `$P/lib/drawing-clipboard.test.ts`, replacing module calls with an instance: `const clipboard = createClipboard();` at the top of each test, then `setClipboard(x)` → `clipboard.set(x)`, `getClipboard()` → `clipboard.get()`, `hasClipboard()` → `clipboard.has()`. Add this case:

```ts
test("two clipboards are independent", () => {
  const a = createClipboard();
  const b = createClipboard();
  const sel = emptySelection();
  sel.hline.push({ id: 1, price: 1, time: 1, style: { width: 1, color: "#fff", pattern: "solid", opacity: 1 } });
  a.set(sel);
  expect(a.has()).toBe(true);
  expect(b.has()).toBe(false);
});
```

Port `$T/lib/drawing-clone.test.ts` to `$P/lib/drawing-clone.test.ts` with R1/R2/R5 (delete vmedian cases; `offsetFromVisibleRange` tests that seeded candles through the chart store call `registerChartEnv(chart, { getBars: () => <same candles>, tickSize: () => 0.01 })` instead).

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/lib/chart-measure.test.ts src/harness src/lib/drawing-clipboard.test.ts src/lib/drawing-clone.test.ts`
Expected: FAIL — modules `./chart-measure`, `./drawing-gesture-geometry`, `./drawing-hover`, `./drawing-clipboard`, `./drawing-clone` not found.

- [ ] **Step 3: Port `chart-measure.ts` with the registry**

```bash
cp $T/lib/chart-measure.ts $P/lib/chart-measure.ts
```

Edits, in order:
1. Delete the imports of `@/app/stores/chart-store`, `@/app/stores/chart-instance-store`, `@/app/stores/chart-tools-store`, `@/app/lib/chart-config`, `@/app/lib/footprint/wire`.
2. Delete `MAGNET_THRESHOLD_PX`, `magnetPriceAtY`, `resolvePaneMagnetTarget`, `magnetSnap`, `softMagnetPriceAtY` and their doc comments.
3. In `paneCustomSeries`, replace `panes[PRICE_PANE_INDEX]` with `panes[0]`.
4. Replace the `OhlcCandle` type and `getPriceBars` with:

```ts
type Bar = { time: number };

/** What chart-measure resolves times and measurements against, per chart. */
export type ChartEnv = { getBars(): readonly Bar[]; tickSize(): number };

const chartEnvs = new WeakMap<IChartApi, ChartEnv>();

/** Registered by DrawingManager for its chart. Returns the unregister function. */
export function registerChartEnv(chart: IChartApi, env: ChartEnv): () => void {
  chartEnvs.set(chart, env);
  return () => {
    if (chartEnvs.get(chart) === env) chartEnvs.delete(chart);
  };
}

function getPriceBars(chart: IChartApi): readonly Bar[] {
  return chartEnvs.get(chart)?.getBars() ?? [];
}
```

5. Replace `computeMeasurement` with:

```ts
export function computeMeasurement(chart: IChartApi, start: MeasurePoint, end: MeasurePoint): MeasurementData {
  const env = chartEnvs.get(chart);
  const barsData = env?.getBars() ?? [];
  const tickSize = env?.tickSize() ?? 0.01;

  const priceDiff = end.price - start.price;
  const pctChange = start.price !== 0 ? (priceDiff / start.price) * 100 : 0;
  const points = priceDiff / tickSize;

  const barInterval = barsData.length >= 2
    ? barsData[barsData.length - 1].time - barsData[barsData.length - 2].time
    : 1;
  const bars = barInterval > 0 ? Math.round(Math.abs(end.time - start.time) / barInterval) : 0;
  const days = Math.abs(end.time - start.time) / 86400;

  return { start, end, priceDiff, pctChange, points, bars, days: Math.round(days), tickSize };
}
```

6. Fix any remaining type error from `OhlcCandle` → `Bar` (only `.time` is read now).

- [ ] **Step 4: Write `$P/harness/drawing-gesture-geometry.ts`**

```ts
import type { ChartPluginContext } from "./chart-plugin";
import type { ChartGeometry } from "./chart-gesture";
import { priceAtY, snapToTick, timeAtX } from "../lib/chart-measure";

/**
 * The sample a drawing-tool drag carries. Fields are individually nullable and
 * channels own their own guards. Both prices are tick-aligned.
 *
 * ponytail: the package has no candle magnet, so `magnetPrice` equals `rawPrice`;
 * the field stays so the ported tool configs read it unchanged.
 */
export type DrawingSample = {
  x: number;
  y: number;
  time: number | null;
  rawPrice: number | null;
  magnetPrice: number | null;
};

/** Production ChartGeometry adapter for drawing-tool drags. */
export function createDrawingGeometry(
  ctx: ChartPluginContext,
  tickSize: () => number,
): ChartGeometry<DrawingSample> {
  const { chart, series, container } = ctx;
  return {
    paneCoords(e: MouseEvent) {
      // Pane-local, not container-local: the container also spans the time axis.
      const rect = (ctx.paneEl?.() ?? container).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= chart.timeScale().width()) return null; // over the price axis, not the plot
      if (y < 0 || y > rect.height) return null; // the time axis
      return { x, y };
    },
    sampleAt(x: number, y: number) {
      const raw = priceAtY(series, y);
      const price = raw == null ? null : snapToTick(raw, tickSize());
      return { x, y, time: timeAtX(chart, x), rawPrice: price, magnetPrice: price };
    },
    lockScroll(locked: boolean) {
      chart.applyOptions({ handleScroll: !locked, handleScale: !locked });
    },
  };
}
```

- [ ] **Step 5: Write `$P/harness/drawing-hover.ts`**

```ts
/**
 * Hover coordinator for one manager's drawing primitives.
 *
 * Each drawing plugin reports its hover candidate on mousemove; candidates are
 * resolved once per microtask. Corner/handle hits beat body/line hits; within a
 * tier the highest id (newest drawing) wins. One arbiter per DrawingManager, so
 * two charts on a page never resolve each other's candidates.
 */
export type HoverPrecision = "corner" | "body";

export type ReportHover = (
  setHovered: (id: number | null) => void,
  id: number | null,
  precision?: HoverPrecision,
) => void;

type HoverCandidate = { id: number; precision: HoverPrecision; setHovered: (id: number | null) => void };

const PRECISION_RANK: Record<HoverPrecision, number> = { corner: 1, body: 0 };

export function createHoverArbiter(): ReportHover {
  let candidates: HoverCandidate[] = [];
  let resolveScheduled = false;

  const resolveHover = () => {
    resolveScheduled = false;
    let winnerId = -1;
    let winnerRank = -1;
    for (const c of candidates) {
      if (c.id < 0) continue;
      const rank = PRECISION_RANK[c.precision];
      if (rank > winnerRank || (rank === winnerRank && c.id > winnerId)) {
        winnerId = c.id;
        winnerRank = rank;
      }
    }
    for (const c of candidates) c.setHovered(c.id === winnerId && winnerId >= 0 ? c.id : null);
    candidates = [];
  };

  return (setHovered, id, precision = "body") => {
    candidates.push({ id: id ?? -1, precision, setHovered });
    if (!resolveScheduled) {
      resolveScheduled = true;
      queueMicrotask(resolveHover);
    }
  };
}
```

- [ ] **Step 6: Write `$P/lib/drawing-clipboard.ts`**

```ts
import { DRAWING_KINDS, type DrawingKind, type DrawingDataMap } from "../model";

export type DrawingSelection = { [K in DrawingKind]: DrawingDataMap[K][] };

export function emptySelection(): DrawingSelection {
  return Object.fromEntries(DRAWING_KINDS.map((k) => [k, []])) as unknown as DrawingSelection;
}

/** In-memory clipboard, one per DrawingManager; stores and returns deep copies. */
export function createClipboard() {
  let clipboard: DrawingSelection | null = null;
  return {
    set(selection: DrawingSelection): void {
      clipboard = structuredClone(selection);
    },
    get(): DrawingSelection | null {
      return clipboard ? structuredClone(clipboard) : null;
    },
    has(): boolean {
      return clipboard !== null && DRAWING_KINDS.some((k) => clipboard![k].length > 0);
    },
  };
}

export type Clipboard = ReturnType<typeof createClipboard>;
```

- [ ] **Step 7: Port `drawing-clone.ts`**

```bash
cp $T/lib/drawing-clone.ts $P/lib/drawing-clone.ts
```

Apply R1 and R2: delete the `VMedianData` import, `cloneVMedian` and its `ponytail:` comment, and the `vmedian` entry of `CLONE_BY_KIND`. Import `BoxData, FibData, DrawingKind, DrawingDataMap` from `../model`, the primitive data types from `../primitives/...`, `ChartPluginContext` from `../harness/chart-plugin`, `priceAtY, timeAtX` from `./chart-measure`.

- [ ] **Step 8: Run the tests**

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/lib src/harness`
Expected: PASS, including the 5 chart-measure, 3 geometry and 2 hover cases above. (`drawing-clone.ts` type-imports primitives that arrive in Task 3; vitest strips types, so it runs.)

- [ ] **Step 9: Commit**

```bash
git add $P/harness/chart-plugin.ts $P/lib/chart-measure.ts $P/lib/chart-measure.test.ts \
  $P/harness/drawing-gesture-geometry.ts $P/harness/drawing-gesture-geometry.test.ts \
  $P/harness/drawing-hover.ts $P/harness/drawing-hover.test.ts \
  $P/lib/drawing-clipboard.ts $P/lib/drawing-clipboard.test.ts $P/lib/drawing-clone.ts $P/lib/drawing-clone.test.ts
git commit -m "feat(plugins): chart env registry, per-manager hover and clipboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Drawing primitives

**Files:**
- Create (port + R1/R2): `$P/primitives/DrawingPrimitiveBase.ts`, `HorizontalLinePrimitive.ts`, `HorizontalRayPrimitive.ts`, `VerticalLinePrimitive.ts`, `TrendLinePrimitive.ts`, `BoxToolPrimitive.ts`, `FibonacciPrimitive.ts`, `FreeDrawPrimitive.ts`, `PathToolPrimitive.ts`, `MeasuringToolPrimitive.ts`, `MarqueeSelectPrimitive.ts`, `chart-drawing.ts`
- Test (port + R1): `$P/primitives/HorizontalLinePrimitive.test.ts`, `TrendLinePrimitive.test.ts`, `VerticalLinePrimitive.test.ts`, `chart-drawing.test.ts`
- Possibly modify: `packages/lightweight-plugins/NOTICE` (Step 5)

**Interfaces:**
- Consumes: Task 1 `model`, `drawing-geometry`, `drawing-style`, `fib-levels`, `marquee-select`; Task 2 `chart-measure`.
- Produces: terminal's primitive classes and data types unchanged: `HLineData`, `RayData`, `VLineData`, `TrendData`, `PathData`, `FreeStrokeData`, `MeasurePoint`/`MeasurementData` users. Each selectable primitive has `selectedId`, `hoveredId`, `marqueeIds`, `select(id)`, `setHovered(id)`, `setMarqueeIds(ids)`, `getEnclosedIds(rect)`, `setDragging(d)` as in terminal.

- [ ] **Step 1: Copy primitives and tests**

```bash
mkdir -p $P/primitives
for f in DrawingPrimitiveBase HorizontalLinePrimitive HorizontalRayPrimitive VerticalLinePrimitive TrendLinePrimitive \
  BoxToolPrimitive FibonacciPrimitive FreeDrawPrimitive PathToolPrimitive MeasuringToolPrimitive MarqueeSelectPrimitive chart-drawing; do
  cp $T/plugins/$f.ts $P/primitives/; done
for f in HorizontalLinePrimitive TrendLinePrimitive VerticalLinePrimitive chart-drawing; do cp $T/plugins/$f.test.ts $P/primitives/; done
grep -rn '@/app' $P/primitives
```

Apply R1 to every hit (`BoxData`/`BoxStyle`/`FibData`/`DEFAULT_BOX_STYLE` → `../model`).

- [ ] **Step 2: Trim `chart-drawing.ts`**

List its exports, then every import of it inside the package:

```bash
grep -nE '^export' $P/primitives/chart-drawing.ts
grep -rhoE 'import \{[^}]+\} from "\./chart-drawing"' $P/primitives | tr ',{}' '\n\n\n' | sed 's/import//;s/from.*//;s/ //g' | sort -u
```

Delete every export (and anything only it uses) that no primitive imports — the order/badge helpers such as `drawBadge`, `BUY_COLOR`, `STOP_COLOR`. Delete the matching cases in `chart-drawing.test.ts`; keep every other case unchanged.

- [ ] **Step 3: Type-check the primitives**

Run: `cd packages/lightweight-plugins && npx tsc --noEmit -p . 2>&1 | grep -E 'src/(primitives|model|lib)/' ; cd -`
Expected: no output. (Errors elsewhere — e.g. old TradingView plugins — are not this task's concern; errors in `src/harness`/`src/tools` can't exist yet.)

- [ ] **Step 4: Run the primitive tests**

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/primitives`
Expected: PASS (the three primitive test files and `chart-drawing.test.ts`).

- [ ] **Step 5: Provenance check against TradingView's plugin examples**

```bash
mkdir -p $SCRATCH/upstream-lwc && cd $SCRATCH/upstream-lwc
for p in trend-line vertical-line; do curl -sfL "https://raw.githubusercontent.com/tradingview/lightweight-charts/v5.2.1/plugin-examples/src/plugins/$p/$p.ts" -o $p.ts; done
curl -sfL "https://raw.githubusercontent.com/tradingview/lightweight-charts/v5.2.1/plugin-examples/src/helpers/dimensions/positions.ts" -o positions.ts
cd -
for pair in "trend-line.ts TrendLinePrimitive.ts" "vertical-line.ts VerticalLinePrimitive.ts" "positions.ts chart-drawing.ts"; do
  set -- $pair; echo "== $1 vs $2"; grep -Fxf <(sed 's/^[[:space:]]*//' $SCRATCH/upstream-lwc/$1 | awk 'length > 25') <(sed 's/^[[:space:]]*//' $P/primitives/$2) | head -20; done
```

Expected: lists of identical non-trivial lines (longer than 25 chars). If a file shares more than 5 such lines with upstream, it is derived: keep `packages/lightweight-plugins/NOTICE` and replace its body with

```
@vecordis/lightweight-plugins
Copyright 2026 Effanuel

Portions of src/primitives/<each file Step 5 matched, comma-separated> are derived from TradingView Lightweight Charts™
plugin examples (https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples),
Copyright 2024 TradingView, Inc., licensed under the Apache License, Version 2.0.
```

Otherwise record "no copied code found" and Task 8 deletes `NOTICE`. Note the result in the commit message body either way.

- [ ] **Step 6: Commit**

```bash
git add $P/primitives/*.ts
git commit -m "feat(plugins): port terminal's drawing primitives

Provenance: <one line — either 'no code copied from TradingView plugin-examples'
or 'derived from plugin-examples: <files>; NOTICE kept'>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Add `packages/lightweight-plugins/NOTICE` to the `git add` if Step 5 changed it.)

---

### Task 4: DrawingStore and ToolState

**Files:**
- Create: `$P/store/drawing-store.ts`, `$P/store/tool-state.ts`
- Test: `$P/store/drawing-store.test.ts`, `$P/store/tool-state.test.ts`

**Interfaces:**
- Consumes: Task 1 `model`, `drawing-history`, `drawing-style`, `fib-levels`.
- Produces:
  - `DrawingStore` with `getState(): DrawingStoreState` (`{ bucket: DrawingsBucket; hidden: boolean; historyVersion: number }`), `subscribe(fn: (state, prev) => void): () => void`, `generateId()`, `items(kind)`, `add(kind, item)`, `update(kind, id, patch)`, `remove(kind, id)`, `slice(kind): DrawingSlice<K>`, `isHidden()`, `setHidden(b)`, `clearAll()`, `edit(fn, mergeKey?)`, `beginEdit()`, `endEdit()`, `untracked(fn)`, `undo(): boolean`, `redo(): boolean`, `load(bucket: DrawingsBucket)`.
  - `ToolState` with `activeTool: ToolName | null` (getter), `setActiveTool(t)`, `clearTool()`, `getLastUsedStyle(slot: StyleSlot)`, `setLastUsedStyle(slot, patch)`, `getLastUsedBoxStyle()`, `setLastUsedBoxStyle(patch)`, `fibLevels: FibLevel[]`, `subscribe(fn: (tool) => void): () => void`.
  - Types `ToolName`, `StyleSlot` (`"h-line" | "h-ray" | "v-line" | "trend" | "fibonacci" | "path"`).

- [ ] **Step 1: Write the failing tests**

`$P/store/drawing-store.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { DrawingStore } from "./drawing-store";
import { emptyBucket } from "../model";
import type { HLineData } from "../primitives/HorizontalLinePrimitive";

const STYLE = { width: 1, color: "#fff", pattern: "solid" as const, opacity: 1 };
const line = (id: number, price = 10): HLineData => ({ id, price, time: 100, style: { ...STYLE } });

describe("DrawingStore", () => {
  test("ids increase from 1", () => {
    const s = new DrawingStore();
    expect([s.generateId(), s.generateId()]).toEqual([1, 2]);
  });

  test("add, update and remove go through the slice", () => {
    const s = new DrawingStore();
    const slice = s.slice("hline");
    slice.add(line(1));
    slice.update(1, { price: 20 });
    expect(s.items("hline")).toEqual([line(1, 20)]);
    slice.remove(1);
    expect(s.items("hline")).toEqual([]);
  });

  test("each bare write is one undo step; redo reapplies it", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.update("hline", 1, { price: 20 });
    expect(s.undo()).toBe(true);
    expect(s.items("hline")).toEqual([line(1, 10)]);
    expect(s.undo()).toBe(true);
    expect(s.items("hline")).toEqual([]);
    expect(s.undo()).toBe(false);
    expect(s.redo()).toBe(true);
    expect(s.items("hline")).toEqual([line(1, 10)]);
  });

  test("edit groups several writes into one step; nested edits join it", () => {
    const s = new DrawingStore();
    s.edit(() => {
      s.add("hline", line(1));
      s.edit(() => s.add("hline", line(2)));
    });
    s.undo();
    expect(s.items("hline")).toEqual([]);
  });

  test("beginEdit/endEdit span a gesture, and undo refuses while it is open", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.beginEdit();
    s.update("hline", 1, { price: 11 });
    s.update("hline", 1, { price: 12 });
    expect(s.undo()).toBe(false);
    s.endEdit();
    s.undo();
    expect(s.items("hline")).toEqual([line(1, 10)]);
  });

  test("edits with the same mergeKey merge into one step", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.edit(() => s.update("hline", 1, { price: 11 }), "popup:1");
    s.edit(() => s.update("hline", 1, { price: 12 }), "popup:1");
    s.undo();
    expect(s.items("hline")).toEqual([line(1, 10)]);
  });

  test("untracked writes are not undoable", () => {
    const s = new DrawingStore();
    s.untracked(() => s.add("hline", line(1)));
    expect(s.undo()).toBe(false);
  });

  test("undo is refused while hidden", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.setHidden(true);
    expect(s.undo()).toBe(false);
  });

  test("clearAll removes everything as one step and unhides", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.add("trend", { id: 2, p1: { price: 1, time: 1 }, p2: { price: 2, time: 2 }, style: { ...STYLE } });
    s.setHidden(true);
    s.clearAll();
    expect(s.items("hline")).toEqual([]);
    expect(s.isHidden()).toBe(false);
    s.undo();
    expect(s.items("hline")).toHaveLength(1);
    expect(s.items("trend")).toHaveLength(1);
  });

  test("undo bumps historyVersion; plain writes don't", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    expect(s.getState().historyVersion).toBe(0);
    s.undo();
    expect(s.getState().historyVersion).toBe(1);
  });

  test("subscribers get (state, prev) on every change", () => {
    const s = new DrawingStore();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.add("hline", line(1));
    expect(fn).toHaveBeenCalledTimes(1);
    const [state, prev] = fn.mock.calls[0];
    expect(state.bucket.hline).toHaveLength(1);
    expect(prev.bucket.hline).toHaveLength(0);
    off();
    s.add("hline", line(2));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("load replaces drawings, clears history, continues ids, bumps historyVersion", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    const bucket = emptyBucket();
    bucket.hline.push(line(7));
    s.load(bucket);
    expect(s.items("hline")).toEqual([line(7)]);
    expect(s.undo()).toBe(false);
    expect(s.generateId()).toBe(8);
    expect(s.getState().historyVersion).toBe(1);
  });

  test("the undo history keeps the last 100 steps", () => {
    const s = new DrawingStore();
    for (let i = 1; i <= 105; i++) s.add("hline", line(i));
    let undone = 0;
    while (s.undo()) undone++;
    expect(undone).toBe(100);
    expect(s.items("hline")).toHaveLength(5);
  });
});
```

`$P/store/tool-state.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { ToolState } from "./tool-state";
import { DEFAULT_DRAWING_STYLE } from "../lib/drawing-style";
import { DEFAULT_BOX_STYLE } from "../model";
import { DEFAULT_FIB_LEVELS } from "../lib/fib-levels";

describe("ToolState", () => {
  test("starts with no tool and default styles", () => {
    const t = new ToolState();
    expect(t.activeTool).toBeNull();
    expect(t.getLastUsedStyle("trend")).toEqual(DEFAULT_DRAWING_STYLE);
    expect(t.getLastUsedBoxStyle()).toEqual(DEFAULT_BOX_STYLE);
    expect(t.fibLevels).toEqual(DEFAULT_FIB_LEVELS);
  });

  test("setActiveTool notifies on change only; clearTool disarms", () => {
    const t = new ToolState();
    const fn = vi.fn();
    t.subscribe(fn);
    t.setActiveTool("trend");
    t.setActiveTool("trend");
    t.clearTool();
    expect(fn.mock.calls).toEqual([["trend"], [null]]);
  });

  test("last-used styles merge per slot", () => {
    const t = new ToolState();
    t.setLastUsedStyle("trend", { color: "#f00" });
    t.setLastUsedBoxStyle({ bgOpacity: 0.5 });
    expect(t.getLastUsedStyle("trend")).toEqual({ ...DEFAULT_DRAWING_STYLE, color: "#f00" });
    expect(t.getLastUsedStyle("h-line")).toEqual(DEFAULT_DRAWING_STYLE);
    expect(t.getLastUsedBoxStyle()).toEqual({ ...DEFAULT_BOX_STYLE, bgOpacity: 0.5 });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/store/drawing-store.test.ts src/store/tool-state.test.ts`
Expected: FAIL — `./drawing-store` and `./tool-state` not found.

- [ ] **Step 3: Write `$P/store/drawing-store.ts`**

```ts
import {
  applyStep,
  closeJournal,
  createDrawingHistory,
  openJournal,
  touch,
  type Journal,
} from "./drawing-history";
import { DRAWING_KINDS, emptyBucket, type DrawingDataMap, type DrawingKind, type DrawingsBucket } from "../model";

// ponytail: one store per chart, so history and the bucket map use one fixed key.
const KEY = "chart";

export type DrawingStoreState = {
  bucket: DrawingsBucket;
  hidden: boolean;
  /** Bumped by every undo/redo/load that changed drawings, so selections can drop. */
  historyVersion: number;
};

export type DrawingSlice<K extends DrawingKind> = {
  items: () => DrawingDataMap[K][];
  add: (item: DrawingDataMap[K]) => void;
  update: (id: number, patch: Partial<Omit<DrawingDataMap[K], "id">>) => void;
  remove: (id: number) => void;
};

type Listener = (state: DrawingStoreState, prev: DrawingStoreState) => void;
type Touch = [kind: DrawingKind, id: number];

/**
 * A chart's drawings plus their undo history: terminal's zustand drawings
 * store without panes, surfaces or persistence. Every mutator journals what
 * it touched; with no edit open a write is its own undo step, inside one it
 * joins that step.
 */
export class DrawingStore {
  private state: DrawingStoreState = { bucket: emptyBucket(), hidden: false, historyVersion: 0 };
  private nextId = 1;
  private readonly history = createDrawingHistory();
  private openEdit: { journal: Journal; depth: number } | null = null;
  private untrackedDepth = 0;
  private readonly listeners = new Set<Listener>();

  getState(): DrawingStoreState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  generateId(): number {
    return this.nextId++;
  }

  items<K extends DrawingKind>(kind: K): DrawingDataMap[K][] {
    return this.state.bucket[kind] as DrawingDataMap[K][];
  }

  add<K extends DrawingKind>(kind: K, item: DrawingDataMap[K]): void {
    this.track([[kind, item.id]], () => this.setKind(kind, [...this.items(kind), item]));
  }

  update<K extends DrawingKind>(kind: K, id: number, patch: Partial<Omit<DrawingDataMap[K], "id">>): void {
    this.track([[kind, id]], () =>
      this.setKind(kind, this.items(kind).map((it) => (it.id === id ? { ...it, ...patch } : it))),
    );
  }

  remove(kind: DrawingKind, id: number): void {
    this.track([[kind, id]], () => this.setKind(kind, this.items(kind).filter((it) => it.id !== id)));
  }

  slice<K extends DrawingKind>(kind: K): DrawingSlice<K> {
    return {
      items: () => this.items(kind),
      add: (item) => this.add(kind, item),
      update: (id, patch) => this.update(kind, id, patch),
      remove: (id) => this.remove(kind, id),
    };
  }

  isHidden(): boolean {
    return this.state.hidden;
  }

  setHidden(hidden: boolean): void {
    if (hidden !== this.state.hidden) this.set({ hidden });
  }

  /** Removes every drawing as one undo step and unhides. */
  clearAll(): void {
    const touches = DRAWING_KINDS.flatMap((kind) => this.items(kind).map((it): Touch => [kind, it.id]));
    this.track(touches, () => this.set({ bucket: emptyBucket(), hidden: false }));
  }

  /** Runs `fn` as one undo step. Nested edits join the outermost, whose `mergeKey` wins. */
  edit(fn: () => void, mergeKey?: string): void {
    this.beginJournal(mergeKey);
    try {
      fn();
    } finally {
      this.endJournal();
    }
  }

  /** `edit` split across events, for a gesture (drag mousedown to mouseup). */
  beginEdit(): void {
    this.beginJournal();
  }

  /** Closes what `beginEdit` opened; a no-op with no edit open. */
  endEdit(): void {
    this.endJournal();
  }

  /** Writes inside `fn` are never journaled. */
  untracked(fn: () => void): void {
    this.untrackedDepth++;
    try {
      fn();
    } finally {
      this.untrackedDepth--;
    }
  }

  /** False, changing nothing, while an edit is open, while hidden, or with nothing to undo. */
  undo(): boolean {
    return this.replay("undo");
  }

  redo(): boolean {
    return this.replay("redo");
  }

  /** Replaces every drawing (not an undo step): clears history, continues ids above the highest loaded. */
  load(bucket: DrawingsBucket): void {
    const ids = DRAWING_KINDS.flatMap((kind) => (bucket[kind] as { id: number }[]).map((it) => it.id));
    this.nextId = Math.max(0, ...ids) + 1;
    this.history.reset();
    this.openEdit = null;
    this.set({ bucket, historyVersion: this.state.historyVersion + 1 });
  }

  private set(patch: Partial<DrawingStoreState>): void {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    for (const listener of [...this.listeners]) listener(this.state, prev);
  }

  private setKind<K extends DrawingKind>(kind: K, items: DrawingDataMap[K][]): void {
    this.set({ bucket: { ...this.state.bucket, [kind]: items } });
  }

  private buckets(): Record<string, DrawingsBucket> {
    return { [KEY]: this.state.bucket };
  }

  private track(touches: Touch[], write: () => void): void {
    if (this.untrackedDepth > 0) return write();
    this.beginJournal();
    try {
      for (const [kind, id] of touches) touch(this.openEdit!.journal, KEY, kind, id);
      write();
    } finally {
      this.endJournal();
    }
  }

  private beginJournal(mergeKey?: string): void {
    if (this.openEdit) {
      this.openEdit.depth++;
      return;
    }
    this.openEdit = { journal: openJournal(KEY, this.buckets(), mergeKey), depth: 1 };
  }

  private endJournal(): void {
    const open = this.openEdit;
    if (!open || --open.depth > 0) return;
    this.openEdit = null;
    this.history.push(KEY, closeJournal(open.journal, this.buckets()));
  }

  private replay(stack: "undo" | "redo"): boolean {
    if (this.openEdit || this.state.hidden) return false;
    const step = this.history.pop(KEY, stack);
    if (!step) return false;
    const next = applyStep(this.buckets(), step, stack === "undo" ? "before" : "after", emptyBucket);
    this.set({ bucket: next[KEY], historyVersion: this.state.historyVersion + 1 });
    return true;
  }
}
```

- [ ] **Step 4: Write `$P/store/tool-state.ts`**

```ts
import { DEFAULT_DRAWING_STYLE, type DrawingStyle } from "../lib/drawing-style";
import { DEFAULT_FIB_LEVELS, type FibLevel } from "../lib/fib-levels";
import { DEFAULT_BOX_STYLE, type BoxStyle } from "../model";

export type ToolName =
  | "select" | "h-line" | "h-ray" | "v-line" | "trend" | "box" | "fibonacci" | "path" | "free-draw" | "measure";

/** Last-used style slots. Free draw shares "path"'s slot, as in terminal; box has its own BoxStyle. */
export type StyleSlot = "h-line" | "h-ray" | "v-line" | "trend" | "fibonacci" | "path";

const STYLE_SLOTS: readonly StyleSlot[] = ["h-line", "h-ray", "v-line", "trend", "fibonacci", "path"];

/** The armed tool and the styles new drawings get: terminal's chart-tools store, unpersisted. */
export class ToolState {
  private tool: ToolName | null = null;
  private styles = Object.fromEntries(STYLE_SLOTS.map((s) => [s, { ...DEFAULT_DRAWING_STYLE }])) as Record<
    StyleSlot,
    DrawingStyle
  >;
  private boxStyle: BoxStyle = { ...DEFAULT_BOX_STYLE };
  readonly fibLevels: FibLevel[] = DEFAULT_FIB_LEVELS;
  private readonly listeners = new Set<(tool: ToolName | null) => void>();

  get activeTool(): ToolName | null {
    return this.tool;
  }

  setActiveTool(tool: ToolName | null): void {
    if (tool === this.tool) return;
    this.tool = tool;
    for (const listener of [...this.listeners]) listener(tool);
  }

  clearTool(): void {
    this.setActiveTool(null);
  }

  getLastUsedStyle(slot: StyleSlot): DrawingStyle {
    return this.styles[slot];
  }

  setLastUsedStyle(slot: StyleSlot, patch: Partial<DrawingStyle>): void {
    this.styles = { ...this.styles, [slot]: { ...this.styles[slot], ...patch } };
  }

  getLastUsedBoxStyle(): BoxStyle {
    return this.boxStyle;
  }

  setLastUsedBoxStyle(patch: Partial<BoxStyle>): void {
    this.boxStyle = { ...this.boxStyle, ...patch };
  }

  subscribe(listener: (tool: ToolName | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/store`
Expected: PASS (13 DrawingStore cases, 3 ToolState cases, plus Task 1's drawing-history tests).

- [ ] **Step 6: Commit**

```bash
git add $P/store/drawing-store.ts $P/store/drawing-store.test.ts $P/store/tool-state.ts $P/store/tool-state.test.ts
git commit -m "feat(plugins): plain DrawingStore and ToolState replace terminal's zustand stores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Interaction harness

**Files:**
- Create/replace: `$P/harness/chart-plugin.ts` (final content; Task 2 committed the same file)
- Create (port + edits): `$P/harness/drawing-tool-plugin.ts`
- Create: `$P/tools/test-fixture.ts` (port of `$T/hooks/drawing-tool-fixture.ts`)
- Test (port + R5): `$P/harness/drawing-tool-plugin.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 4.
- Produces:
  - `chart-plugin.ts`: `ChartPluginContext`, `ClickResult`, `Teardown`, `ChartPlugin`, `ToolEnv`.
  - `drawing-tool-plugin.ts`: terminal's `StoreSlice`, `SelectedDrawing`, `DrawingPrimitiveAdapter`, `CreationSpec`, `GestureSpec`, `DrawingToolKit`, `DrawingToolConfig` (with `tool: ToolName` and new required field `env: ToolEnv`; no `surface`, no `shouldResetOnChartChange`), `DrawingToolApi`, `createDrawingToolPlugin(config)`.
  - `tools/test-fixture.ts`: `makeEnv(): ToolEnv`, `makeGeometry()`, `makeDom()`, `mouse(x, y, opts?)`, `mountTool(config)` → `{ api, fire, teardown }`.

- [ ] **Step 1: Write `$P/harness/chart-plugin.ts`**

```ts
import type { IChartApi, ISeriesPrimitive, MouseEventHandler, Time } from "lightweight-charts";
import type { PriceConverter } from "../lib/chart-measure";
import type { DrawingStore } from "../store/drawing-store";
import type { ToolState } from "../store/tool-state";
import type { ReportHover } from "./drawing-hover";

export type ChartPluginContext = {
  readonly chart: IChartApi;
  /** Price↔pixel only. */
  readonly series: PriceConverter;
  readonly container: HTMLDivElement;
  /** The pane element drawings live in, resolved per call. Null → callers fall back to the container. */
  readonly paneEl?: () => HTMLElement | null;
};

export type ClickResult = "consumed" | "pass";

export type Teardown = () => void;

export interface ChartPlugin {
  readonly name: string;
  readonly clickPriority?: number;
  primitives(): ReadonlyArray<ISeriesPrimitive<Time>>;
  onMount?(ctx: ChartPluginContext): Teardown;
  onChartClick?(param: Parameters<MouseEventHandler<Time>>[0], ctx: ChartPluginContext): ClickResult;
}

/** Everything a tool reads besides its chart: terminal's stores and pane state, per DrawingManager. */
export type ToolEnv = {
  readonly drawings: DrawingStore;
  readonly tools: ToolState;
  tickSize(): number;
  readonly reportHover: ReportHover;
  /** Whether this manager owns keyboard shortcuts right now (keyboard on, and its chart was clicked last). */
  keysActive(): boolean;
};
```

- [ ] **Step 2: Port the fixture and the harness test (failing)**

```bash
mkdir -p $P/tools
cp $T/hooks/drawing-tool-fixture.ts $P/tools/test-fixture.ts
cp $T/lib/drawing-tool-plugin.test.ts $P/harness/drawing-tool-plugin.test.ts
```

In `$P/tools/test-fixture.ts`: apply R1; delete the `useChartStore` import and `seedLinearCandles`; add

```ts
import { DrawingStore } from "../store/drawing-store";
import { ToolState } from "../store/tool-state";
import { createHoverArbiter } from "../harness/drawing-hover";
import { registerChartEnv } from "../lib/chart-measure";
import type { ToolEnv } from "../harness/chart-plugin";

/** A fresh env per test: empty store, no tool armed, tick 0.01, keyboard owned. */
export function makeEnv(): ToolEnv {
  return {
    drawings: new DrawingStore(),
    tools: new ToolState(),
    tickSize: () => 0.01,
    reportHover: createHoverArbiter(),
    keysActive: () => true,
  };
}
```

and in `mountTool`, replace `seedLinearCandles();` with (after `chart` is built)

```ts
  registerChartEnv(chart as never, { getBars: () => [{ time: 0 }, { time: 10 }], tickSize: () => 0.01 });
```

and drop `paneId: "a"` from `ctx`.

In `$P/harness/drawing-tool-plugin.test.ts`: apply R1/R5. Concretely: a module-level `let env: ToolEnv;` with `beforeEach(() => { env = makeEnv(); })`; `makeSlice()` becomes `env.drawings.slice("box")`; every `useDrawingsStore.getState().X(…, PANE_ID …)` becomes `env.drawings.X(…)` per R4; every `useChartToolsStore.getState().setActiveTool(t)` / `.setState({ activeTool: t })` becomes `env.tools.setActiveTool(t)`; every config object built in the test gets `env` (and loses `surface`); `paneId: PANE_ID` leaves the fake ctx. Delete the describe blocks "split-pane mode ownership" and any test that drives `useChartStore` (symbol/interval reset) or uses `RANGE_INTERVAL`.

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/harness/drawing-tool-plugin.test.ts`
Expected: FAIL — `./drawing-tool-plugin` not found.

- [ ] **Step 3: Port the harness**

```bash
cp $T/lib/drawing-tool-plugin.ts $P/harness/drawing-tool-plugin.ts
```

Apply R1 for the imports that stay (`./chart-plugin`, `./chart-gesture`, `./drawing-gesture-geometry`, `./drawing-hover` for the `HoverPrecision` type, `../lib/dom-events`), delete the imports of `chart-tools-store`, `chart-store`, `drawings-store`, `chart-config`, and import `type ToolName` from `../store/tool-state` and `type ToolEnv` from `./chart-plugin`. Then make exactly these edits:

1. `DrawingToolConfig`: `tool: ChartTool;` → `tool: ToolName;`; delete the `surface?` field and `shouldResetOnChartChange?`; add as the first field

```ts
  /** The manager's stores, tick size, hover arbiter and keyboard gate. */
  env: ToolEnv;
```

2. In `createDrawingToolPlugin`: `const { primitive, slice } = config;` → `const { primitive, slice, env } = config;`. Replace `let mountedPane: PaneId | null = null;` with `let mounted = false;`.
3. `editSelected`:

```ts
  const editSelected = (fn: () => void) => {
    if (!mounted) return fn();
    env.drawings.edit(fn, `popup:${session}`);
  };
```

4. `isArmed`/`disarm`:

```ts
  const isArmed = () => env.tools.activeTool === config.tool;
  const disarm = () => env.tools.clearTool();
```

5. Delete `surface: config.surface,` from the plugin object.
6. In `onMount`: `const geometry = (config.geometry ?? createDrawingGeometry)(ctx);` →

```ts
      const geometry = config.geometry?.(ctx) ?? createDrawingGeometry(ctx, env.tickSize);
```

   `mountedPane = ctx.paneId;` → `mounted = true;`.
7. `endDragEdit`: `useDrawingsStore.getState().endEdit(ctx.paneId);` → `env.drawings.endEdit();`.
8. Both `useDrawingsStore.getState().generateId()` → `env.drawings.generateId()`.
9. In `onMouseDown`: `if (useChartToolsStore.getState().activeTool != null) return;` → `if (env.tools.activeTool != null) return;`; replace

```ts
        const store = useDrawingsStore.getState();
        store.beginEdit(ctx.paneId);
```

   with `env.drawings.beginEdit();` and `store.endEdit(ctx.paneId);` with `env.drawings.endEdit();`.
10. `onMouseLeave` and `onContainerMouseMove`: `reportHover(` → `env.reportHover(`; `useChartToolsStore.getState().activeTool == null` → `env.tools.activeTool == null`.
11. `onKeyDown`: make the first line `if (!env.keysActive()) return;` (before the text-entry guard).
12. `syncPrimitive`: `useDrawingsStore.getState().hidden` → `env.drawings.isHidden()`.
13. Delete the `shouldReset` const and the whole `unsubChart = useChartStore.subscribe(...)` block, and `unsubChart();` in the teardown. `useDrawingsStore.subscribe(` → `env.drawings.subscribe(`.
14. Teardown: `mountedPane = null;` → `mounted = false;`.
15. Update the doc comment above `createDrawingToolPlugin`: drop "symbol reset" and "`useDrawingToolPlugin` is the thin hook shell"; say the manager owns mounting.

- [ ] **Step 4: Run the harness test**

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/harness`
Expected: PASS for every remaining case of the ported harness test (terminal had 49; minus the deleted split-pane/reset cases).

- [ ] **Step 5: Commit**

```bash
git add $P/harness/chart-plugin.ts $P/harness/drawing-tool-plugin.ts $P/harness/drawing-tool-plugin.test.ts $P/tools/test-fixture.ts
git commit -m "feat(plugins): drawing-tool harness on ToolEnv instead of app stores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tool configs, measure and marquee

**Files:**
- Create (port of each hook's `xxxConfig`): `$P/tools/horizontal-line.ts` (`hlineConfig`), `horizontal-ray.ts` (`rayConfig`), `vertical-line.ts` (`vlineConfig`), `trend-line.ts` (`trendConfig`), `box.ts` (`boxConfig`), `fibonacci.ts` (`fibConfig`), `path.ts` (`pathConfig`), `free-draw.ts` (`freeDrawConfig`)
- Create (new): `$P/tools/measure.ts`, `$P/tools/marquee.ts`
- Test (port + R5): `$P/tools/horizontal-line.test.ts`, `horizontal-ray.test.ts`, `vertical-line.test.ts`, `trend-line.test.ts`, `box.test.ts`, `fibonacci.test.ts`, `path.test.ts`, `free-draw.test.ts`; new `$P/tools/measure.test.ts`, `$P/tools/marquee.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `xxxConfig(primitive, env: ToolEnv): DrawingToolConfig<…>` for the 8 tools (signature changed from `(primitive, paneId, surface)`).
  - `createMeasureTool(env: ToolEnv): ChartPlugin`.
  - `createMarqueeTool(env: ToolEnv, primitives: Record<DrawingKind, MarqueeablePrimitive>): MarqueeTool` where `MarqueeTool = { plugin: ChartPlugin; selection(): Record<DrawingKind, ReadonlySet<number>>; clear(): void; copy(): boolean; paste(): boolean; deleteSelection(): boolean; onChange(cb: () => void): () => void }`.

- [ ] **Step 1: Copy hooks and their tests**

```bash
port() { cp $T/hooks/$1.ts $P/tools/$2.ts; cp $T/hooks/$1.test.ts $P/tools/$2.test.ts; }
port useHorizontalLinePlugin horizontal-line; port useHorizontalRayPlugin horizontal-ray
port useVerticalLinePlugin vertical-line; port useTrendLinePlugin trend-line; port useBoxToolPlugin box
port useFibonacciPlugin fibonacci; port usePathToolPlugin path; port useFreeDrawPlugin free-draw
```

- [ ] **Step 2: Port the tests (failing)**

In each `$P/tools/*.test.ts`: R1 (`./drawing-tool-fixture` → `./test-fixture`, `./useXxxPlugin` → `./<file>`), R5: a module-level `let env: ToolEnv` reset in `beforeEach` via `makeEnv()`, with the test's armed tool set by `env.tools.setActiveTool("<tool>")`; `xxxConfig(primitive, "a")` → `xxxConfig(primitive, env)`; store reads per R4. Delete CVD/surface cases.

Write `$P/tools/measure.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createMeasureTool } from "./measure";
import { makeDom, makeEnv, mouse } from "./test-fixture";
import { registerChartEnv } from "../lib/chart-measure";
import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
});

function mount() {
  const { container, fire } = makeDom();
  (container as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 900, height: 400 }) as DOMRect;
  const chart = {
    applyOptions: vi.fn(),
    timeScale: () => ({ width: () => 800, coordinateToLogical: (x: number) => x, timeToCoordinate: (t: number) => t / 10 }),
  };
  registerChartEnv(chart as never, { getBars: () => [{ time: 0 }, { time: 10 }], tickSize: () => 0.01 });
  const ctx = { chart, series: { priceToCoordinate: (p: number) => p, coordinateToPrice: (c: number) => c }, container } as unknown as ChartPluginContext;
  const plugin = createMeasureTool(env);
  const teardown = plugin.onMount!(ctx);
  const primitive = plugin.primitives()[0] as unknown as { measurement: unknown };
  return { plugin, ctx, fire, teardown, primitive };
}

describe("measure tool", () => {
  test("two clicks measure and disarm; nothing is stored", () => {
    const { fire, primitive } = mount();
    env.tools.setActiveTool("measure");
    fire("container", "mousedown", mouse(10, 100));
    fire("container", "mousedown", mouse(50, 80));
    expect(primitive.measurement).toBeTruthy();
    expect(env.tools.activeTool).toBeNull();
    expect(Object.values(env.drawings.getState().bucket).every((items) => items.length === 0)).toBe(true);
    expect(env.drawings.undo()).toBe(false);
  });

  test("the next chart click after finishing is swallowed, the one after clears", () => {
    const { plugin, ctx, fire, primitive } = mount();
    env.tools.setActiveTool("measure");
    fire("container", "mousedown", mouse(10, 100));
    fire("container", "mousedown", mouse(50, 80));
    expect(plugin.onChartClick!({} as never, ctx)).toBe("consumed");
    expect(primitive.measurement).toBeTruthy();
    expect(plugin.onChartClick!({} as never, ctx)).toBe("consumed");
    expect(primitive.measurement).toBeFalsy();
    expect(plugin.onChartClick!({} as never, ctx)).toBe("pass");
  });

  test("Escape cancels and disarms", () => {
    const { fire } = mount();
    env.tools.setActiveTool("measure");
    fire("container", "mousedown", mouse(10, 100));
    fire("document", "keydown", { key: "Escape" });
    expect(env.tools.activeTool).toBeNull();
  });
});
```

Write `$P/tools/marquee.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createMarqueeTool, type MarqueeablePrimitive } from "./marquee";
import { makeDom, makeEnv } from "./test-fixture";
import { DRAWING_KINDS, type DrawingKind } from "../model";
import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";

const STYLE = { width: 1, color: "#fff", pattern: "solid" as const, opacity: 1 };

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
});

function fakePrimitives(enclosed: number[]): Record<DrawingKind, MarqueeablePrimitive> {
  return Object.fromEntries(
    DRAWING_KINDS.map((k) => [
      k,
      { selectedId: null, setMarqueeIds: vi.fn(), getEnclosedIds: () => (k === "hline" ? enclosed : []) },
    ]),
  ) as unknown as Record<DrawingKind, MarqueeablePrimitive>;
}

function mount(enclosed: number[]) {
  const { container, fire } = makeDom();
  (container as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 900, height: 400 }) as DOMRect;
  const chart = { applyOptions: vi.fn(), timeScale: () => ({ width: () => 800, coordinateToLogical: () => null }) };
  const ctx = { chart, series: { priceToCoordinate: () => null, coordinateToPrice: () => null }, container } as unknown as ChartPluginContext;
  const tool = createMarqueeTool(env, fakePrimitives(enclosed));
  tool.plugin.onMount!(ctx);
  return { tool, fire };
}

const down = (x: number, y: number, ctrlKey = true) =>
  ({ clientX: x, clientY: y, button: 0, ctrlKey, metaKey: false, defaultPrevented: false, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() });

describe("marquee tool", () => {
  test("Ctrl+drag selects enclosed drawings and notifies", () => {
    env.drawings.add("hline", { id: 1, price: 1, time: 1, style: { ...STYLE } });
    const { tool, fire } = mount([1]);
    const changed = vi.fn();
    tool.onChange(changed);
    fire("container", "mousedown", down(10, 10));
    fire("window", "mouseup", down(200, 200));
    expect([...tool.selection().hline]).toEqual([1]);
    expect(changed).toHaveBeenCalled();
  });

  test("copy then paste adds offset clones as one undo step and selects them", () => {
    env.drawings.add("hline", { id: 1, price: 1, time: 1, style: { ...STYLE } });
    const { tool, fire } = mount([1]);
    fire("container", "mousedown", down(10, 10));
    fire("window", "mouseup", down(200, 200));
    expect(tool.copy()).toBe(true);
    expect(tool.paste()).toBe(true);
    expect(env.drawings.items("hline")).toHaveLength(2);
    expect(tool.selection().hline.size).toBe(1);
    env.drawings.undo();
    expect(env.drawings.items("hline")).toHaveLength(1);
  });

  test("deleteSelection removes the selection as one step", () => {
    env.drawings.add("hline", { id: 1, price: 1, time: 1, style: { ...STYLE } });
    env.drawings.add("hline", { id: 2, price: 2, time: 2, style: { ...STYLE } });
    const { tool, fire } = mount([1, 2]);
    fire("container", "mousedown", down(10, 10));
    fire("window", "mouseup", down(200, 200));
    expect(tool.deleteSelection()).toBe(true);
    expect(env.drawings.items("hline")).toHaveLength(0);
    env.drawings.undo();
    expect(env.drawings.items("hline")).toHaveLength(2);
  });

  test("keys are ignored when this manager doesn't own the keyboard", () => {
    env.drawings.add("hline", { id: 1, price: 1, time: 1, style: { ...STYLE } });
    env = { ...env, keysActive: () => false };
    const { fire } = mount([1]);
    fire("container", "mousedown", down(10, 10));
    fire("window", "mouseup", down(200, 200));
    fire("document", "keydown", { key: "Delete", ctrlKey: false, metaKey: false, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() });
    expect(env.drawings.items("hline")).toHaveLength(1);
  });
});
```

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/tools`
Expected: FAIL — configs still have terminal signatures; `./measure` and `./marquee` not found.

- [ ] **Step 3: Port each config file**

For each `$P/tools/<file>.ts`:
1. R1 for the imports that stay; delete imports of `react`, `use-lazy-ref`, `useDrawingToolPlugin`, `usePaneId`, `chart-store`, `chart-tools-store`, `drawings-store` (types it needs come from `../model`), `chart-config`.
2. Signature: `export function xxxConfig(primitive: XPrimitive, paneId: PaneId, surface: DrawingSurface = "price")` → `export function xxxConfig(primitive: XPrimitive, env: ToolEnv)`, importing `type ToolEnv` from `../harness/chart-plugin`.
3. In the returned config: delete `surface,`; add `env,` as the first property.
4. Every remaining store/pane read per R4. Specifically: `hline`/`ray` tick sizes in `applyData`; `fib` `applyData` tick size, `fibLevels` (lines 166/188 in terminal) and its `shouldResetOnChartChange` (delete); `ray`/`box`/`fib`/`path` alt-clone `generateId`; `path` finalize (`store.generateId()`, `clearTool()`); `free-draw` `onMountEffect` finalize (`store.generateId()`).
5. Delete the exported React hook at the bottom (`export function useXxxPlugin() { … }`).

Then check: `grep -nE 'useDrawingsStore|useChartToolsStore|useChartStore|paneState|paneId|surface|react' $P/tools/*.ts | grep -v test` prints nothing.

- [ ] **Step 4: Write `$P/tools/measure.ts`**

```ts
import type { ChartPlugin, ChartPluginContext, ClickResult, Teardown, ToolEnv } from "../harness/chart-plugin";
import { MeasuringToolPrimitive } from "../primitives/MeasuringToolPrimitive";
import { computeMeasurement, getChartPaneCoords, priceAtY, timeAtX, type MeasurePoint } from "../lib/chart-measure";

/**
 * Two-click measure: anchor, then end. The result stays until the next chart
 * click. Not a drawing — never stored, never undoable. Terminal's measuring
 * tool without the magnet and the range-mode reset.
 */
export function createMeasureTool(env: ToolEnv): ChartPlugin {
  const primitive = new MeasuringToolPrimitive();
  let justFinalized = false;
  const armed = () => env.tools.activeTool === "measure";

  return {
    name: "measuring-tool",
    clickPriority: 200,

    primitives() {
      return [primitive];
    },

    onChartClick(): ClickResult {
      if (armed()) return "consumed";
      if (justFinalized) {
        justFinalized = false;
        return "consumed";
      }
      if (primitive.measurement) {
        primitive.clearMeasurement();
        return "consumed";
      }
      return "pass";
    },

    onMount(ctx: ChartPluginContext): Teardown {
      const { chart, series, container } = ctx;
      let anchor: MeasurePoint | null = null;

      const lockScroll = (locked: boolean) => chart.applyOptions({ handleScroll: !locked, handleScale: !locked });

      const pointAt = (e: MouseEvent): MeasurePoint | null => {
        const pos = getChartPaneCoords(e, container);
        if (pos.x >= chart.timeScale().width()) return null;
        const price = priceAtY(series, pos.y);
        const time = timeAtX(chart, pos.x);
        return price == null || time == null ? null : { price, time };
      };

      const onMouseDown = (e: MouseEvent) => {
        if (!armed() || e.button !== 0) return;
        const point = pointAt(e);
        if (!point) return;
        if (!anchor) {
          anchor = point;
          primitive.clearMeasurement();
          lockScroll(true);
        } else {
          primitive.setMeasurement(anchor, point, computeMeasurement(chart, anchor, point));
          anchor = null;
          lockScroll(false);
          justFinalized = true;
          env.tools.clearTool();
        }
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!anchor) return;
        const point = pointAt(e);
        if (point) primitive.setMeasurement(anchor, point, computeMeasurement(chart, anchor, point));
      };

      const cancel = (disarm = true) => {
        if (anchor) {
          anchor = null;
          lockScroll(false);
        }
        primitive.clearMeasurement();
        if (disarm) env.tools.clearTool();
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (env.keysActive() && e.key === "Escape") cancel();
      };

      const onContextMenu = (e: MouseEvent) => {
        if (!armed()) return;
        e.preventDefault();
        cancel();
      };

      const doc = container.ownerDocument;
      container.addEventListener("mousedown", onMouseDown);
      container.addEventListener("mousemove", onMouseMove);
      container.addEventListener("contextmenu", onContextMenu);
      doc.addEventListener("keydown", onKeyDown);

      return () => {
        cancel(false);
        container.removeEventListener("mousedown", onMouseDown);
        container.removeEventListener("mousemove", onMouseMove);
        container.removeEventListener("contextmenu", onContextMenu);
        doc.removeEventListener("keydown", onKeyDown);
      };
    },
  };
}
```

- [ ] **Step 5: Write `$P/tools/marquee.ts`**

```ts
import type { ChartPlugin, ChartPluginContext, Teardown, ToolEnv } from "../harness/chart-plugin";
import { MarqueeSelectPrimitive } from "../primitives/MarqueeSelectPrimitive";
import { DRAWING_KINDS, type DrawingKind } from "../model";
import { getChartPaneCoords } from "../lib/chart-measure";
import { rectFromPoints, rectIsMeaningful, type PixelRect } from "../lib/marquee-select";
import { CLONE_BY_KIND, offsetFromVisibleRange } from "../lib/drawing-clone";
import { createClipboard, emptySelection as emptyClipboardSelection, type DrawingSelection } from "../lib/drawing-clipboard";
import { isTextEntryTarget } from "../lib/dom-events";

export interface MarqueeablePrimitive {
  setMarqueeIds(ids: ReadonlySet<number>): void;
  getEnclosedIds(rect: PixelRect): number[];
  selectedId: number | null;
}

type Selection = Record<DrawingKind, Set<number>>;

const emptySelection = (): Selection =>
  Object.fromEntries(DRAWING_KINDS.map((k) => [k, new Set<number>()])) as Selection;

export type MarqueeTool = {
  plugin: ChartPlugin;
  selection(): Record<DrawingKind, ReadonlySet<number>>;
  clear(): void;
  /** Copies the marquee + single selections; false when nothing is selected. */
  copy(): boolean;
  /** Pastes offset clones as one undo step and selects them; false with an empty clipboard or before mount. */
  paste(): boolean;
  /** Deletes the marquee selection as one undo step; false when it is empty. */
  deleteSelection(): boolean;
  onChange(cb: () => void): () => void;
};

/**
 * Marquee multi-select, copy/paste and multi-delete: terminal's
 * useMarqueeSelectPlugin without React and app stores. Ctrl/Cmd+drag from any
 * mode, or plain drag with the "select" tool. Mount it before the drawing
 * tools: its mousedown and keydown listeners must run first, because it stops
 * propagation to claim a Ctrl+drag and a multi-selection Delete.
 */
export function createMarqueeTool(env: ToolEnv, primitives: Record<DrawingKind, MarqueeablePrimitive>): MarqueeTool {
  const marquee = new MarqueeSelectPrimitive();
  const clipboard = createClipboard();
  const listeners = new Set<() => void>();
  let selection: Selection = emptySelection();
  let mountedCtx: ChartPluginContext | null = null;

  const setSelection = (sel: Selection) => {
    selection = sel;
    for (const k of DRAWING_KINDS) primitives[k].setMarqueeIds(sel[k]);
    for (const cb of [...listeners]) cb();
  };
  const hasSelection = () => DRAWING_KINDS.some((k) => selection[k].size > 0);
  const clear = () => {
    if (hasSelection()) setSelection(emptySelection());
  };

  // Union of the marquee selection and any per-tool single selection.
  const gatherSelection = (): DrawingSelection => {
    const out = emptyClipboardSelection();
    for (const k of DRAWING_KINDS) {
      const ids = new Set<number>(selection[k]);
      const single = primitives[k].selectedId;
      if (single != null) ids.add(single);
      // @ts-expect-error index access is sound: items(k) returns DrawingDataMap[k][]
      out[k] = env.drawings.items(k).filter((d) => ids.has(d.id));
    }
    return out;
  };

  const copy = () => {
    const sel = gatherSelection();
    if (DRAWING_KINDS.every((k) => sel[k].length === 0)) return false;
    clipboard.set(sel);
    return true;
  };

  const paste = () => {
    const clip = clipboard.get();
    if (!clip || !mountedCtx || !clipboard.has()) return false;
    const offset = offsetFromVisibleRange(mountedCtx);
    const next = emptySelection();
    env.drawings.edit(() => {
      for (const k of DRAWING_KINDS) {
        for (const item of clip[k]) {
          const id = env.drawings.generateId();
          // @ts-expect-error CLONE_BY_KIND[k] and add(k) share the same DrawingDataMap[k]
          env.drawings.add(k, CLONE_BY_KIND[k](item, id, offset));
          next[k].add(id);
        }
      }
    });
    setSelection(next);
    return true;
  };

  const deleteSelection = () => {
    if (!hasSelection()) return false;
    const sel = selection;
    env.drawings.edit(() => {
      for (const k of DRAWING_KINDS) sel[k].forEach((id) => env.drawings.remove(k, id));
    });
    clear();
    return true;
  };

  const plugin: ChartPlugin = {
    name: "marquee-select",
    // Above the drawing tools (200) so a Ctrl+drag is claimed before they react.
    clickPriority: 300,

    primitives() {
      return [marquee];
    },

    onMount(ctx: ChartPluginContext): Teardown {
      const { chart, container } = ctx;
      mountedCtx = ctx;
      let drag: { startX: number; startY: number } | null = null;
      const lockScroll = (locked: boolean) => chart.applyOptions({ handleScroll: !locked, handleScale: !locked });

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0 || e.defaultPrevented) return;
        const modifier = e.ctrlKey || e.metaKey;
        if (!modifier && env.tools.activeTool !== "select") {
          clear(); // a plain click dismisses the marquee selection
          return;
        }
        const pos = getChartPaneCoords(e, container);
        if (pos.x >= chart.timeScale().width()) return; // the price axis
        clear();
        drag = { startX: pos.x, startY: pos.y };
        marquee.setRect({ minX: pos.x, minY: pos.y, maxX: pos.x, maxY: pos.y });
        lockScroll(true);
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!drag) return;
        const pos = getChartPaneCoords(e, container);
        marquee.setRect(rectFromPoints(drag.startX, drag.startY, pos.x, pos.y));
      };

      const onMouseUp = (e: MouseEvent) => {
        if (!drag) return;
        const pos = getChartPaneCoords(e, container);
        const rect = rectFromPoints(drag.startX, drag.startY, pos.x, pos.y);
        drag = null;
        marquee.setRect(null);
        lockScroll(false);
        if (!rectIsMeaningful(rect)) return; // a tiny drag is a click
        const sel = emptySelection();
        for (const k of DRAWING_KINDS) sel[k] = new Set(primitives[k].getEnclosedIds(rect));
        setSelection(sel);
        // The "select" tool is single-use, like the drawing tools; Ctrl+drag never touches it.
        if (env.tools.activeTool === "select") env.tools.clearTool();
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (!env.keysActive() || isTextEntryTarget(e.target)) return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && (e.key === "c" || e.key === "C")) {
          if (copy()) e.preventDefault(); // nothing selected → native copy runs
          return;
        }
        if (mod && (e.key === "v" || e.key === "V")) {
          if (paste()) e.preventDefault();
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          if (!deleteSelection()) return;
          e.preventDefault();
          // The marquee owns this Delete: the tools must not also delete their single selection.
          e.stopImmediatePropagation();
        } else if (e.key === "Escape") {
          clear();
          if (env.tools.activeTool === "select") env.tools.clearTool();
        }
      };

      // An undo/redo/load may have removed selected drawings: drop the selection.
      const unsubHistory = env.drawings.subscribe((s, prev) => {
        if (s.historyVersion !== prev.historyVersion) clear();
      });

      const doc = container.ownerDocument;
      const win = doc.defaultView!;
      container.addEventListener("mousedown", onMouseDown);
      container.addEventListener("mousemove", onMouseMove);
      win.addEventListener("mouseup", onMouseUp);
      doc.addEventListener("keydown", onKeyDown);

      return () => {
        unsubHistory();
        if (drag) lockScroll(false);
        clear();
        mountedCtx = null;
        container.removeEventListener("mousedown", onMouseDown);
        container.removeEventListener("mousemove", onMouseMove);
        win.removeEventListener("mouseup", onMouseUp);
        doc.removeEventListener("keydown", onKeyDown);
      };
    },
  };

  return {
    plugin,
    selection: () => selection,
    clear,
    copy,
    paste,
    deleteSelection,
    onChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
```

- [ ] **Step 6: Run the tool tests**

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/tools`
Expected: PASS for the 8 ported config test files plus 3 measure and 4 marquee cases.

- [ ] **Step 7: Commit**

```bash
git add $P/tools/*.ts
git commit -m "feat(plugins): port the eight drawing tools, measure and marquee onto ToolEnv

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: DrawingManager and public exports

**Files:**
- Create: `$P/drawing-manager.ts`
- Modify: `$P/index.ts` (add exports; old TradingView exports stay until Task 8)
- Modify: `packages/lightweight-plugins/test/smoke.mjs`
- Test: `$P/drawing-manager.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces (public API, exported from `index.ts`): `DrawingManager`, `DrawingManagerOptions`, `Drawing`, `DrawingKindName`, `ToolName`, `DrawingStyle`, `BoxStyle`, `FibLevel`, `DEFAULT_DRAWING_STYLE`, `DEFAULT_BOX_STYLE`, `DEFAULT_FIB_LEVELS`, and the data types `HLineData`, `RayData`, `VLineData`, `TrendData`, `BoxData`, `FibData`, `PathData`, `FreeStrokeData`.
- `DrawingManager` members exactly as the spec's Public API table.

- [ ] **Step 1: Write the failing test**

`$P/drawing-manager.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IChartApi, ISeriesApi, ISeriesPrimitive, SeriesType, Time } from "lightweight-charts";
import { DrawingManager, type Drawing } from "./drawing-manager";

const STYLE = { width: 1, color: "#ffffff", pattern: "solid" as const, opacity: 1 };

/**
 * A fake chart whose single pane is an 800×400 element at the page origin.
 * x maps to logical index x (bars every 10s from time 0), y maps to price y.
 */
function fakeChart(opts: { minMove?: number; data?: { time: number }[] } = {}) {
  const container = document.createElement("div");
  const pane = document.createElement("div");
  container.appendChild(pane);
  document.body.appendChild(container);
  pane.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 400, right: 900, bottom: 400, x: 0, y: 0, toJSON() {} });
  container.getBoundingClientRect = pane.getBoundingClientRect;

  let data = opts.data ?? Array.from({ length: 100 }, (_, i) => ({ time: i * 10 }));
  const dataListeners = new Set<() => void>();
  const clickListeners = new Set<(p: unknown) => void>();
  const attached: ISeriesPrimitive<Time>[] = [];

  const chart = {
    chartElement: () => container,
    panes: () => [{ getHTMLElement: () => pane, getSeries: () => [series] }],
    applyOptions: vi.fn(),
    timeScale: () => ({
      width: () => 800,
      coordinateToLogical: (x: number) => x,
      timeToCoordinate: (t: number) => t / 10,
      getVisibleLogicalRange: () => ({ from: 0, to: 80 }),
    }),
    subscribeClick: (fn: (p: unknown) => void) => clickListeners.add(fn),
    unsubscribeClick: (fn: (p: unknown) => void) => clickListeners.delete(fn),
  } as unknown as IChartApi;

  const series = {
    options: () => ({ priceFormat: { type: "price", minMove: opts.minMove ?? 0.01 } }),
    data: () => data,
    subscribeDataChanged: (fn: () => void) => dataListeners.add(fn),
    unsubscribeDataChanged: (fn: () => void) => dataListeners.delete(fn),
    priceToCoordinate: (p: number) => p,
    coordinateToPrice: (c: number) => c,
    attachPrimitive: (p: ISeriesPrimitive<Time>) => {
      attached.push(p);
      // Like lightweight-charts: a primitive's requestUpdate re-runs its views.
      p.attached?.({ chart, series, requestUpdate: () => p.updateAllViews?.() } as never);
    },
    detachPrimitive: (p: ISeriesPrimitive<Time>) => {
      attached.splice(attached.indexOf(p), 1);
      p.detached?.();
    },
  } as unknown as ISeriesApi<SeriesType>;

  const setData = (next: { time: number }[]) => {
    data = next;
    for (const fn of [...dataListeners]) fn();
  };
  return { chart, series, container, pane, attached, clickListeners, setData };
}

const fire = (el: EventTarget, type: string, init: MouseEventInit & KeyboardEventInit = {}) =>
  el.dispatchEvent(
    type === "keydown"
      ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
      : new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }),
  );
const flush = () => new Promise<void>((r) => queueMicrotask(r));

let managers: DrawingManager[] = [];
const make = (...args: ConstructorParameters<typeof DrawingManager>) => {
  const m = new DrawingManager(...args);
  managers.push(m);
  return m;
};
beforeEach(() => {
  managers = [];
});
afterEach(() => {
  for (const m of managers) m.destroy();
  document.body.innerHTML = "";
});

const hline = (id: number, price = 50): Drawing => ({ kind: "h-line", id, price, time: 100, style: { ...STYLE } });

describe("DrawingManager", () => {
  test("setTool arms a tool and emits toolChange", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    const seen: (string | null)[] = [];
    m.on("toolChange", (t) => seen.push(t));
    m.setTool("trend");
    m.setTool(null);
    expect(m.getTool()).toBeNull();
    expect(seen).toEqual(["trend", null]);
  });

  test("clicking with the h-line tool adds one h-line at the clicked price, then disarms", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    const change = vi.fn();
    m.on("change", change);
    m.setTool("h-line");
    fire(f.pane, "mousedown", { clientX: 100, clientY: 123.456 });
    const drawings = m.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]).toMatchObject({ kind: "h-line", price: 123.46 });
    expect(m.getTool()).toBeNull();
    expect(change).toHaveBeenCalled();
  });

  test("tickSize defaults to the series minMove", () => {
    const f = fakeChart({ minMove: 0.25 });
    const m = make(f.chart, f.series);
    m.setTool("h-line");
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50.3 });
    expect(m.getDrawings()[0]).toMatchObject({ price: 50.25 });
  });

  test("bars follow series data changes", () => {
    const f = fakeChart({ data: [] });
    const m = make(f.chart, f.series);
    f.setData(Array.from({ length: 50 }, (_, i) => ({ time: 1000 + i * 60 })));
    m.setTool("v-line");
    fire(f.pane, "mousedown", { clientX: 3, clientY: 50 });
    expect(m.getDrawings()[0]).toMatchObject({ kind: "v-line", time: 1180 });
  });

  test("getDrawings and setDrawings round-trip and clear history", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    const saved: Drawing[] = [
      hline(3),
      { kind: "trend", id: 5, p1: { price: 10, time: 0 }, p2: { price: 20, time: 100 }, style: { ...STYLE } },
      { kind: "box", id: 7, p1: { price: 10, time: 0 }, p2: { price: 20, time: 100 }, style: { borderColor: "#fff", borderWidth: 1, borderOpacity: 1, bgColor: "#000", bgOpacity: 0.1 } },
    ];
    m.setDrawings(saved);
    expect(m.getDrawings()).toEqual(saved);
    expect(m.undo()).toBe(false);
  });

  test("setDrawings rejects an unknown kind and keeps the current drawings", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1)]);
    expect(() => m.setDrawings([{ ...hline(2), kind: "circle" } as unknown as Drawing])).toThrow(/unknown drawing kind "circle"/i);
    expect(m.getDrawings()).toEqual([hline(1)]);
  });

  test("setDrawings rejects duplicate and non-integer ids", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    expect(() => m.setDrawings([hline(1), hline(1)])).toThrow(/duplicate drawing id 1/i);
    expect(() => m.setDrawings([hline(1.5)])).toThrow(/invalid drawing id/i);
    expect(m.getDrawings()).toEqual([]);
  });

  test("clear is one undo step", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1), hline(2)]);
    m.clear();
    expect(m.getDrawings()).toEqual([]);
    expect(m.undo()).toBe(true);
    expect(m.getDrawings()).toHaveLength(2);
    expect(m.redo()).toBe(true);
    expect(m.getDrawings()).toEqual([]);
  });

  test("setHidden hides without deleting", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1)]);
    m.setHidden(true);
    expect(m.isHidden()).toBe(true);
    expect(m.getDrawings()).toHaveLength(1);
  });

  test("selecting a drawing by click, then setStyle applies only the keys its style has, as one step", async () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1, 50)]);
    const sel = vi.fn();
    m.on("selectionChange", sel);
    fire(f.pane, "mousemove", { clientX: 100, clientY: 50 });
    await flush();
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    fire(window, "mouseup", { clientX: 100, clientY: 50 });
    expect(m.getSelection().map((d) => d.id)).toEqual([1]);
    expect(sel).toHaveBeenCalled();
    m.setStyle({ color: "#ff0000", bgColor: "#00ff00" });
    expect(m.getDrawings()[0].style).toEqual({ ...STYLE, color: "#ff0000" });
    m.undo();
    expect(m.getDrawings()[0].style).toEqual(STYLE);
  });

  test("deleteSelected, then copy and paste", async () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1, 50)]);
    fire(f.pane, "mousemove", { clientX: 100, clientY: 50 });
    await flush();
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    fire(window, "mouseup", { clientX: 100, clientY: 50 });
    expect(m.copy()).toBe(true);
    expect(m.paste()).toBe(true);
    expect(m.getDrawings()).toHaveLength(2);
    // The paste becomes the marquee selection (terminal keeps the source's single selection too).
    expect(m.getSelection().map((d) => d.id)).toContain(2);
    m.deleteSelected(); // the marquee selection owns the delete, as with the Delete key
    expect(m.getDrawings().map((d) => d.id)).toEqual([1]);
  });

  test("keyboard: Ctrl+Z undoes, Delete deletes the selection", async () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setTool("h-line");
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    expect(m.getDrawings()).toHaveLength(1);
    fire(document, "keydown", { key: "Delete" });
    expect(m.getDrawings()).toHaveLength(0);
    fire(document, "keydown", { key: "z", ctrlKey: true });
    expect(m.getDrawings()).toHaveLength(1);
  });

  test("two managers: keys go only to the last-clicked chart", () => {
    const a = fakeChart();
    const b = fakeChart();
    const ma = make(a.chart, a.series);
    const mb = make(b.chart, b.series);
    ma.setTool("h-line");
    fire(a.pane, "mousedown", { clientX: 100, clientY: 50 });
    mb.setTool("h-line");
    fire(b.pane, "mousedown", { clientX: 100, clientY: 60 });
    fire(document, "keydown", { key: "z", ctrlKey: true });
    expect(ma.getDrawings()).toHaveLength(1);
    expect(mb.getDrawings()).toHaveLength(0);
  });

  test("keyboard: false leaves keys to the app", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series, { keyboard: false });
    m.setTool("h-line");
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    fire(document, "keydown", { key: "z", ctrlKey: true });
    expect(m.getDrawings()).toHaveLength(1);
  });

  test("destroy removes every listener", () => {
    const f = fakeChart();
    const m = new DrawingManager(f.chart, f.series);
    m.setDrawings([hline(1)]);
    m.destroy();
    expect(f.attached).toHaveLength(0);
    expect(f.clickListeners.size).toBe(0);
    m.setTool("h-line");
    fire(f.pane, "mousedown", { clientX: 100, clientY: 70 });
    fire(document, "keydown", { key: "z", ctrlKey: true });
    expect(m.getDrawings()).toEqual([hline(1)]);
  });
});
```

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run src/drawing-manager.test.ts`
Expected: FAIL — `./drawing-manager` not found.

- [ ] **Step 2: Write `$P/drawing-manager.ts`**

```ts
import type { IChartApi, ISeriesApi, MouseEventParams, SeriesType, Time } from "lightweight-charts";
import type { ChartPlugin, ChartPluginContext, ToolEnv } from "./harness/chart-plugin";
import { createDrawingToolPlugin, type DrawingToolApi } from "./harness/drawing-tool-plugin";
import { createHoverArbiter } from "./harness/drawing-hover";
import { registerChartEnv } from "./lib/chart-measure";
import { isTextEntryTarget } from "./lib/dom-events";
import type { DrawingStyle } from "./lib/drawing-style";
import { DRAWING_KINDS, emptyBucket, type BoxStyle, type DrawingDataMap, type DrawingKind } from "./model";
import { DrawingStore } from "./store/drawing-store";
import { ToolState, type StyleSlot, type ToolName } from "./store/tool-state";
import { BoxToolPrimitive } from "./primitives/BoxToolPrimitive";
import { FibonacciPrimitive } from "./primitives/FibonacciPrimitive";
import { FreeDrawPrimitive } from "./primitives/FreeDrawPrimitive";
import { HorizontalLinePrimitive } from "./primitives/HorizontalLinePrimitive";
import { HorizontalRayPrimitive } from "./primitives/HorizontalRayPrimitive";
import { PathToolPrimitive } from "./primitives/PathToolPrimitive";
import { TrendLinePrimitive } from "./primitives/TrendLinePrimitive";
import { VerticalLinePrimitive } from "./primitives/VerticalLinePrimitive";
import { boxConfig } from "./tools/box";
import { fibConfig } from "./tools/fibonacci";
import { freeDrawConfig } from "./tools/free-draw";
import { hlineConfig } from "./tools/horizontal-line";
import { rayConfig } from "./tools/horizontal-ray";
import { pathConfig } from "./tools/path";
import { trendConfig } from "./tools/trend-line";
import { vlineConfig } from "./tools/vertical-line";
import { createMarqueeTool, type MarqueeTool } from "./tools/marquee";
import { createMeasureTool } from "./tools/measure";

export type { ToolName };

const KIND_TO_PUBLIC = {
  hline: "h-line",
  ray: "h-ray",
  vline: "v-line",
  trend: "trend",
  box: "box",
  fib: "fibonacci",
  path: "path",
  freedraw: "free-draw",
} as const satisfies Record<DrawingKind, string>;

export type DrawingKindName = (typeof KIND_TO_PUBLIC)[DrawingKind];

const PUBLIC_TO_KIND = Object.fromEntries(
  Object.entries(KIND_TO_PUBLIC).map(([kind, name]) => [name, kind]),
) as Record<DrawingKindName, DrawingKind>;

/** A stored drawing as the API hands it out: its data plus a `kind` tag. Serializable. */
export type Drawing = {
  [K in DrawingKind]: { kind: (typeof KIND_TO_PUBLIC)[K] } & DrawingDataMap[K];
}[DrawingKind];

export type DrawingManagerOptions = {
  /** Price grid drawings snap to. Defaults to the series' priceFormat.minMove, else 0.01. */
  tickSize?: number;
  /** Delete, Escape, undo/redo and copy/paste shortcuts. Default true. */
  keyboard?: boolean;
};

type Events = {
  change: () => void;
  toolChange: (tool: ToolName | null) => void;
  selectionChange: (selection: Drawing[]) => void;
};

const DRAWING_STYLE_KEYS = ["width", "color", "pattern", "opacity"] as const;
const BOX_STYLE_KEYS = ["borderColor", "borderWidth", "borderOpacity", "bgColor", "bgOpacity"] as const;

const STYLE_SLOT: Record<Exclude<ToolName, "select" | "measure" | "box">, StyleSlot> = {
  "h-line": "h-line",
  "h-ray": "h-ray",
  "v-line": "v-line",
  trend: "trend",
  fibonacci: "fibonacci",
  path: "path",
  "free-draw": "path",
};

// The manager whose chart last received a mousedown owns keyboard shortcuts.
let activeManager: DrawingManager | null = null;

function readBars(series: ISeriesApi<SeriesType>): { time: number }[] {
  const bars: { time: number }[] = [];
  for (const item of series.data()) if (typeof item.time === "number") bars.push({ time: item.time });
  return bars;
}

function seriesMinMove(series: ISeriesApi<SeriesType>): number {
  const format = series.options().priceFormat as { minMove?: number };
  return format.minMove && format.minMove > 0 ? format.minMove : 0.01;
}

function pick<T extends object>(patch: object, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) if (key in patch) out[key] = (patch as T)[key];
  return out;
}

/**
 * Mouse-driven drawing tools for one lightweight-charts series: arm a tool,
 * place drawings by clicking, drag to move or reshape, select, delete, undo,
 * copy/paste and marquee-select. Times are UTCTimestamp seconds.
 */
export class DrawingManager {
  private readonly drawings = new DrawingStore();
  private readonly tools = new ToolState();
  private readonly apis: { kind: DrawingKind; api: DrawingToolApi<unknown> }[];
  private readonly marquee: MarqueeTool;
  private readonly listeners = new Map<keyof Events, Set<(...args: never[]) => void>>();
  private readonly teardown: () => void;

  constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, options: DrawingManagerOptions = {}) {
    const keyboard = options.keyboard ?? true;
    const tickSize = () => options.tickSize ?? seriesMinMove(series);

    let bars = readBars(series);
    const onData = () => {
      bars = readBars(series);
    };
    series.subscribeDataChanged(onData);
    const unregister = registerChartEnv(chart, { getBars: () => bars, tickSize });

    const env: ToolEnv = {
      drawings: this.drawings,
      tools: this.tools,
      tickSize,
      reportHover: createHoverArbiter(),
      keysActive: () => keyboard && activeManager === this,
    };

    const prims = {
      hline: new HorizontalLinePrimitive(),
      ray: new HorizontalRayPrimitive(),
      vline: new VerticalLinePrimitive(),
      trend: new TrendLinePrimitive(),
      box: new BoxToolPrimitive(),
      fib: new FibonacciPrimitive(),
      path: new PathToolPrimitive(),
      freedraw: new FreeDrawPrimitive(),
    };
    this.apis = [
      { kind: "hline", api: createDrawingToolPlugin(hlineConfig(prims.hline, env)) },
      { kind: "ray", api: createDrawingToolPlugin(rayConfig(prims.ray, env)) },
      { kind: "vline", api: createDrawingToolPlugin(vlineConfig(prims.vline, env)) },
      { kind: "trend", api: createDrawingToolPlugin(trendConfig(prims.trend, env)) },
      { kind: "box", api: createDrawingToolPlugin(boxConfig(prims.box, env)) },
      { kind: "fib", api: createDrawingToolPlugin(fibConfig(prims.fib, env)) },
      { kind: "path", api: createDrawingToolPlugin(pathConfig(prims.path, env)) },
      { kind: "freedraw", api: createDrawingToolPlugin(freeDrawConfig(prims.freedraw, env)) },
    ];
    this.marquee = createMarqueeTool(env, prims);

    // Marquee first: its listeners must run before the tools' (it stops propagation).
    const plugins: ChartPlugin[] = [this.marquee.plugin, ...this.apis.map((a) => a.api.plugin), createMeasureTool(env)];

    const container = chart.chartElement();
    const ctx: ChartPluginContext = {
      chart,
      series,
      container,
      paneEl: () => {
        try {
          return chart.panes()[0]?.getHTMLElement() ?? null;
        } catch {
          return null;
        }
      },
    };

    const teardowns: (() => void)[] = [];
    for (const plugin of plugins) {
      for (const prim of plugin.primitives()) series.attachPrimitive(prim);
      if (plugin.onMount) teardowns.push(plugin.onMount(ctx));
    }

    const byPriority = plugins
      .filter((p) => p.onChartClick)
      .sort((a, b) => (b.clickPriority ?? 0) - (a.clickPriority ?? 0));
    const onClick = (param: MouseEventParams<Time>) => {
      for (const plugin of byPriority) if (plugin.onChartClick!(param, ctx) === "consumed") break;
    };
    chart.subscribeClick(onClick);

    const activate = () => {
      activeManager = this;
    };
    container.addEventListener("mousedown", activate, true);
    if (activeManager === null) activeManager = this;

    // Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z and Ctrl+Y redo. Consumed only when a step applied.
    const doc = container.ownerDocument;
    const onUndoKeys = (e: KeyboardEvent) => {
      if (!env.keysActive() || e.defaultPrevented || isTextEntryTarget(e.target)) return;
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || (key === "y" && e.ctrlKey && !e.shiftKey);
      if (!isUndo && !isRedo) return;
      if (isUndo ? this.drawings.undo() : this.drawings.redo()) e.preventDefault();
    };
    doc.addEventListener("keydown", onUndoKeys);

    const emitSelection = () => this.emit("selectionChange", this.getSelection());
    const unsubs = [
      this.drawings.subscribe((s, prev) => {
        if (s.bucket !== prev.bucket) this.emit("change");
      }),
      this.tools.subscribe((tool) => this.emit("toolChange", tool)),
      this.marquee.onChange(emitSelection),
      ...this.apis.map((a) => a.api.onSelectionChange(emitSelection)),
    ];

    this.teardown = () => {
      for (const unsub of unsubs) unsub();
      doc.removeEventListener("keydown", onUndoKeys);
      container.removeEventListener("mousedown", activate, true);
      if (activeManager === this) activeManager = null;
      chart.unsubscribeClick(onClick);
      for (const td of teardowns) td();
      for (const plugin of plugins) for (const prim of plugin.primitives()) series.detachPrimitive(prim);
      unregister();
      series.unsubscribeDataChanged(onData);
      this.listeners.clear();
    };
  }

  setTool(tool: ToolName | null): void {
    this.tools.setActiveTool(tool);
  }

  getTool(): ToolName | null {
    return this.tools.activeTool;
  }

  getDrawings(): Drawing[] {
    return DRAWING_KINDS.flatMap((kind) =>
      this.drawings.items(kind).map((item) => ({ kind: KIND_TO_PUBLIC[kind], ...structuredClone(item) }) as Drawing),
    ).sort((a, b) => a.id - b.id);
  }

  /** Replaces every drawing and clears undo history. Throws, changing nothing, on invalid input. */
  setDrawings(list: readonly Drawing[]): void {
    const bucket = emptyBucket();
    const seen = new Set<number>();
    for (const drawing of list) {
      const kind = PUBLIC_TO_KIND[drawing.kind as DrawingKindName];
      if (!kind) throw new Error(`Unknown drawing kind "${String(drawing.kind)}"`);
      if (!Number.isInteger(drawing.id) || drawing.id < 1) throw new Error(`Invalid drawing id ${String(drawing.id)}`);
      if (seen.has(drawing.id)) throw new Error(`Duplicate drawing id ${drawing.id}`);
      seen.add(drawing.id);
      const item = structuredClone(drawing) as { kind?: string; id: number };
      delete item.kind;
      (bucket[kind] as { id: number }[]).push(item);
    }
    this.drawings.load(bucket);
  }

  /** Removes every drawing as one undo step. */
  clear(): void {
    this.drawings.clearAll();
  }

  setHidden(hidden: boolean): void {
    this.drawings.setHidden(hidden);
  }

  isHidden(): boolean {
    return this.drawings.isHidden();
  }

  getSelection(): Drawing[] {
    const ids = this.selectedIds();
    return this.getDrawings().filter((d) => ids.get(PUBLIC_TO_KIND[d.kind])?.has(d.id));
  }

  /** Restyles the selection as one undo step; each drawing takes only the keys its style type has. */
  setStyle(patch: Partial<DrawingStyle & BoxStyle>): void {
    const selected = this.selectedIds();
    this.drawings.edit(() => {
      for (const [kind, ids] of selected) {
        const picked = kind === "box" ? pick<BoxStyle>(patch, BOX_STYLE_KEYS) : pick<DrawingStyle>(patch, DRAWING_STYLE_KEYS);
        if (Object.keys(picked).length === 0) continue;
        for (const item of this.drawings.items(kind)) {
          if (ids.has(item.id)) this.drawings.update(kind, item.id, { style: { ...item.style, ...picked } } as never);
        }
      }
    });
  }

  /** The style a tool's next drawings get. */
  setToolStyle(tool: Exclude<ToolName, "select" | "measure">, patch: Partial<DrawingStyle> | Partial<BoxStyle>): void {
    if (tool === "box") this.tools.setLastUsedBoxStyle(patch as Partial<BoxStyle>);
    else this.tools.setLastUsedStyle(STYLE_SLOT[tool], patch as Partial<DrawingStyle>);
  }

  deleteSelected(): void {
    if (this.marquee.deleteSelection()) return;
    for (const { api } of this.apis) if (api.getSelected()) api.deleteSelected();
  }

  undo(): boolean {
    return this.drawings.undo();
  }

  redo(): boolean {
    return this.drawings.redo();
  }

  copy(): boolean {
    return this.marquee.copy();
  }

  paste(): boolean {
    return this.marquee.paste();
  }

  on<E extends keyof Events>(event: E, cb: Events[E]): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(cb as (...args: never[]) => void);
    return () => {
      set.delete(cb as (...args: never[]) => void);
    };
  }

  destroy(): void {
    this.teardown();
  }

  private emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): void {
    for (const cb of [...(this.listeners.get(event) ?? [])]) (cb as (...a: Parameters<Events[E]>) => void)(...args);
  }

  private selectedIds(): Map<DrawingKind, Set<number>> {
    const marquee = this.marquee.selection();
    const out = new Map<DrawingKind, Set<number>>(DRAWING_KINDS.map((k) => [k, new Set(marquee[k])]));
    for (const { kind, api } of this.apis) {
      const single = api.getSelected();
      if (single) out.get(kind)!.add(single.id);
    }
    return out;
  }
}
```

- [ ] **Step 3: Export from `index.ts`**

Append to `$P/index.ts` (the TradingView exports above stay until Task 8):

```ts
export { DrawingManager } from "./drawing-manager";
export type { Drawing, DrawingKindName, DrawingManagerOptions, ToolName } from "./drawing-manager";
export { DEFAULT_DRAWING_STYLE, type DrawingStyle } from "./lib/drawing-style";
export { DEFAULT_FIB_LEVELS, type FibLevel } from "./lib/fib-levels";
export { DEFAULT_BOX_STYLE, type BoxStyle, type BoxData, type FibData } from "./model";
export type { HLineData } from "./primitives/HorizontalLinePrimitive";
export type { RayData } from "./primitives/HorizontalRayPrimitive";
export type { VLineData } from "./primitives/VerticalLinePrimitive";
export type { TrendData } from "./primitives/TrendLinePrimitive";
export type { PathData } from "./primitives/PathToolPrimitive";
export type { FreeStrokeData } from "./primitives/FreeDrawPrimitive";
```

In `test/smoke.mjs`, add `'DrawingManager', 'DEFAULT_BOX_STYLE', 'DEFAULT_DRAWING_STYLE', 'DEFAULT_FIB_LEVELS'` to `EXPECTED` and change the per-name loop to check only that each name is defined (`assert.notEqual(mod[name], undefined, name)`), since the defaults are objects.

- [ ] **Step 4: Run all package tests and the build**

Run: `pnpm -F @vecordis/lightweight-plugins exec vitest run && pnpm build:plugins && pnpm -F @vecordis/lightweight-plugins test`
Expected: every vitest file passes (16 new manager cases included); tsup ESM + DTS build succeeds; `smoke ok: 18 exports, lightweight-charts external`.

- [ ] **Step 5: Confirm no React/zustand reached the package**

Run: `git grep -nE 'zustand|from "react"' packages/lightweight-plugins/src`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add $P/drawing-manager.ts $P/drawing-manager.test.ts $P/index.ts packages/lightweight-plugins/test/smoke.mjs
git commit -m "feat(plugins): DrawingManager public API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Site, removal of the TradingView plugins, docs and 0.2.0

**Files:**
- Delete: every TradingView plugin under `$P/plugins/` (the 14 dirs and `plugin-base.ts`), `$P/helpers/`, `src/showcase/demos.ts`, `src/showcase/PluginCard.tsx`, and `packages/lightweight-plugins/NOTICE` unless Task 3 kept it
- Replace: `$P/index.ts` (drawing exports only), `packages/lightweight-plugins/README.md`, `README.md`
- Modify: `packages/lightweight-plugins/package.json` (`version`, `description`, `keywords`), `packages/lightweight-plugins/test/smoke.mjs`, `eslint.config.mjs`, `src/showcase/sample-data.ts`, `src/app/page.tsx`
- Create: `src/showcase/DrawingDemo.tsx`, `src/showcase/tool-icons.tsx` (port of terminal's), `src/showcase/seed-drawings.ts`
- Test (scratchpad, not committed): `$SCRATCH/drawings-check/check.mjs`

**Interfaces:**
- Consumes: Task 7's public API.
- Produces: the site's `/` with `window.drawings` set to its `DrawingManager`.

- [ ] **Step 1: Write the browser check (fails on the current site)**

```bash
mkdir -p $SCRATCH/drawings-check && cd $SCRATCH/drawings-check && npm init -y >/dev/null && npm i playwright@1.59.1 && npx playwright install chromium; cd -
```

`$SCRATCH/drawings-check/check.mjs`:

```js
import { chromium } from "playwright";

const url = process.env.URL ?? "http://localhost:3100/";
const out = new URL(".", import.meta.url).pathname;
const browser = await chromium.launch();
const errors = [];
let failed = false;
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed = true;
};

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url, { waitUntil: "networkidle" });

const ready = await page.evaluate(() => typeof window.drawings?.getDrawings === "function");
check(ready, "window.drawings is a DrawingManager");
if (!ready) {
  await browser.close();
  process.exit(1);
}

const count = () => page.evaluate(() => window.drawings.getDrawings().length);
const kinds = () => page.evaluate(() => window.drawings.getDrawings().map((d) => d.kind));
const box = await page.locator("#chart").boundingBox();
// Plot area: keep clear of the price axis (right ~70px) and time axis (bottom ~30px).
const at = (fx, fy) => ({ x: box.x + 20 + fx * (box.width - 110), y: box.y + 20 + fy * (box.height - 70) });
const click = async (p) => {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
};
const arm = (label) => page.getByRole("button", { name: label, exact: true }).click();

const start = await count();
const gestures = [
  ["Horizontal line", "h-line", async () => click(at(0.2, 0.15))],
  ["Horizontal ray", "h-ray", async () => click(at(0.3, 0.85))],
  ["Vertical line", "v-line", async () => click(at(0.12, 0.5))],
  ["Trend line", "trend", async () => { await click(at(0.35, 0.3)); await click(at(0.5, 0.2)); }],
  ["Box", "box", async () => { await click(at(0.55, 0.6)); await click(at(0.65, 0.75)); }],
  ["Fibonacci", "fibonacci", async () => { await click(at(0.7, 0.3)); await click(at(0.8, 0.5)); }],
  ["Path", "path", async () => { await click(at(0.4, 0.6)); await click(at(0.45, 0.7)); await click(at(0.45, 0.7)); }],
  ["Free draw", "free-draw", async () => {
    const a = at(0.6, 0.4);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + i * 8, a.y + (i % 3) * 6);
    await page.mouse.up();
    await page.keyboard.press("Escape"); // free draw stays armed like a pencil
  }],
];
for (const [label, kind, gesture] of gestures) {
  const before = await kinds();
  await arm(label);
  await gesture();
  const after = await kinds();
  check(after.length === before.length + 1 && after.filter((k) => k === kind).length === before.filter((k) => k === kind).length + 1, `${label} adds one ${kind}`);
}

const beforeMeasure = await count();
await arm("Measure");
await click(at(0.2, 0.7));
await click(at(0.3, 0.6));
check((await count()) === beforeMeasure, "Measure adds no drawing");
await click(at(0.9, 0.9)); // clears the measurement

// Select + drag the first h-line down by 60px.
const hl = await page.evaluate(() => window.drawings.getDrawings().find((d) => d.kind === "h-line" && d.id > 4));
const hlY = at(0.2, 0.15).y;
await page.mouse.move(at(0.25, 0.15).x, hlY);
await page.mouse.down();
await page.mouse.move(at(0.25, 0.15).x, hlY + 30);
await page.mouse.move(at(0.25, 0.15).x, hlY + 60);
await page.mouse.up();
const moved = await page.evaluate((id) => window.drawings.getDrawings().find((d) => d.id === id), hl.id);
check(moved && moved.price < hl.price, "dragging an h-line down lowers its price");

const n = await count();
await page.keyboard.press("Delete");
check((await count()) === n - 1, "Delete removes the selected drawing");
await page.keyboard.press("Control+z");
check((await count()) === n, "Ctrl+Z restores it");
await page.keyboard.press("Control+Shift+z");
check((await count()) === n - 1, "Ctrl+Shift+Z removes it again");
await page.keyboard.press("Control+z");

// Marquee over the trend line and box, then copy/paste.
const m1 = at(0.33, 0.15);
const m2 = at(0.67, 0.8);
await page.keyboard.down("Control");
await page.mouse.move(m1.x, m1.y);
await page.mouse.down();
await page.mouse.move((m1.x + m2.x) / 2, (m1.y + m2.y) / 2);
await page.mouse.move(m2.x, m2.y);
await page.mouse.up();
await page.keyboard.up("Control");
const selected = await page.evaluate(() => window.drawings.getSelection().length);
check(selected >= 2, `marquee selects >= 2 drawings (got ${selected})`);
const beforePaste = await count();
await page.keyboard.press("Control+c");
await page.keyboard.press("Control+v");
check((await count()) === beforePaste + selected, "Ctrl+C / Ctrl+V duplicates the selection");
await page.keyboard.press("Escape");
check((await page.evaluate(() => window.drawings.getSelection().length)) === 0, "Escape clears the selection");

check((await count()) > start, "drawings were added");
await page.screenshot({ path: `${out}drawings-1280.png`, fullPage: true });

for (const width of [1024, 390]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(300);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(sw <= width, `no horizontal scroll at ${width} (scrollWidth ${sw})`);
  await page.screenshot({ path: `${out}drawings-${width}.png`, fullPage: true });
}

check(errors.length === 0, `no console errors (${errors.length})`);
errors.forEach((e) => console.log("  error:", e));
await browser.close();
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
```

`$SCRATCH/drawings-check/run.sh`:

```bash
#!/usr/bin/env bash
# Starts the built app on :3100, runs check.mjs, stops the server. Run from the worktree root.
S=/tmp/claude-1000/-home-vecordis-GitHub-lightweight-plugins/6ed9957d-b624-4877-a751-e474017dd25e/scratchpad
(pnpm exec next start -p 3100 > $S/drawings-server.log 2>&1 &)
curl -s --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:3100/ && node $S/drawings-check/check.mjs
r=$?
fuser -k 3100/tcp > /dev/null 2>&1
exit $r
```

Run: `chmod +x $SCRATCH/drawings-check/run.sh && pnpm build && $SCRATCH/drawings-check/run.sh`
Expected: `FAIL window.drawings is a DrawingManager`, exit 1.

- [ ] **Step 2: Port the icons**

```bash
cp /home/vecordis/GitHub/terminal-orderflow/frontend/src/app/components/tool-icons.tsx src/showcase/tool-icons.tsx
```

Delete `MagnetIcon` and `VMedianIcon` from it.

- [ ] **Step 3: Seeded candles and starter drawings**

Replace `src/showcase/sample-data.ts` with only `rng`, `day` and `candleData` (delete `lineData`, `heatmapData`, `whiskerData`, `groupedBarsData` and the `@vecordis/lightweight-plugins` type import), and change `candleData`'s default `count` to `200`.

Create `src/showcase/seed-drawings.ts`:

```ts
import type { CandlestickData } from "lightweight-charts";
import { DEFAULT_BOX_STYLE, DEFAULT_DRAWING_STYLE, type Drawing } from "@vecordis/lightweight-plugins";

/** A horizontal line, trend line, box and Fibonacci placed on the seeded candles. */
export function seedDrawings(candles: CandlestickData[]): Drawing[] {
  const t = (i: number) => candles[i].time as number;
  const n = candles.length;
  const lows = candles.slice(n - 45, n - 25).map((c) => c.low);
  const highs = candles.slice(n - 45, n - 25).map((c) => c.high);
  return [
    { kind: "h-line", id: 1, price: Number(candles[n - 1].close.toFixed(2)), time: t(n - 1), style: { ...DEFAULT_DRAWING_STYLE, color: "#ff9800", pattern: "dashed" } },
    { kind: "trend", id: 2, p1: { price: candles[n - 80].low, time: t(n - 80) }, p2: { price: candles[n - 50].high, time: t(n - 50) }, style: { ...DEFAULT_DRAWING_STYLE, color: "#2962ff", width: 2 } },
    { kind: "box", id: 3, p1: { price: Math.max(...highs), time: t(n - 45) }, p2: { price: Math.min(...lows), time: t(n - 25) }, style: { ...DEFAULT_BOX_STYLE } },
    { kind: "fibonacci", id: 4, p1: { price: candles[n - 20].high, time: t(n - 20) }, p2: { price: candles[n - 8].low, time: t(n - 8) }, style: { ...DEFAULT_DRAWING_STYLE, color: "#089981" } },
  ];
}
```

- [ ] **Step 4: Write `src/showcase/DrawingDemo.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { CandlestickSeries, createChart } from "lightweight-charts";
import { BoxSelect, Eye, EyeOff, Pencil, Redo2, Trash2, Undo2, X } from "lucide-react";
import { DrawingManager, type Drawing, type ToolName } from "@vecordis/lightweight-plugins";
import { ChartOptions } from "@/components/Chart/chart-options";
import { candleData } from "./sample-data";
import { seedDrawings } from "./seed-drawings";
import { BoxIcon, FibIcon, HLineIcon, HRayIcon, MeasureIcon, PathIcon, TrendIcon, VLineIcon } from "./tool-icons";

declare global {
  interface Window {
    drawings?: DrawingManager;
  }
}

const TOOLS: { id: ToolName; label: string; hint?: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "select", label: "Select", hint: "drag a box, or Ctrl+drag", icon: BoxSelect },
  { id: "h-line", label: "Horizontal line", icon: HLineIcon },
  { id: "h-ray", label: "Horizontal ray", icon: HRayIcon },
  { id: "v-line", label: "Vertical line", icon: VLineIcon },
  { id: "trend", label: "Trend line", hint: "two clicks", icon: TrendIcon },
  { id: "box", label: "Box", hint: "two clicks", icon: BoxIcon },
  { id: "fibonacci", label: "Fibonacci", hint: "two clicks", icon: FibIcon },
  { id: "path", label: "Path", hint: "click points, click the last again to finish", icon: PathIcon },
  { id: "free-draw", label: "Free draw", hint: "press and drag; Esc to stop", icon: Pencil },
  { id: "measure", label: "Measure", hint: "two clicks", icon: MeasureIcon },
];

const COLORS = ["#ffffff", "#2962ff", "#f23645", "#089981", "#ff9800", "#9c27b0", "#ffeb3b", "#00bcd4"];
const WIDTHS = [1, 2, 3, 4];
const PATTERNS = ["solid", "dashed", "dotted"] as const;

const button = "flex h-9 w-9 shrink-0 items-center justify-center rounded text-gray-300 hover:bg-white/10";

export default function DrawingDemo() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [manager, setManager] = useState<DrawingManager | null>(null);
  const [tool, setTool] = useState<ToolName | null>(null);
  const [selection, setSelection] = useState<Drawing[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const chart = createChart(el, ChartOptions);
    const series = chart.addSeries(CandlestickSeries);
    const candles = candleData();
    series.setData(candles);
    const m = new DrawingManager(chart, series);
    m.setDrawings(seedDrawings(candles));
    const offs = [
      m.on("toolChange", setTool),
      m.on("selectionChange", setSelection),
      m.on("change", () => setSelection(m.getSelection())),
    ];
    window.drawings = m;
    // Subscribing to an external system: the manager is created here, so this is its first sync.
    setManager(m); // eslint-disable-line react-hooks/set-state-in-effect
    return () => {
      offs.forEach((off) => off());
      m.destroy();
      chart.remove();
      if (window.drawings === m) delete window.drawings;
    };
  }, []);

  const toggleHidden = () => {
    if (!manager) return;
    manager.setHidden(!hidden);
    setHidden(!hidden);
  };
  const hasBox = selection.some((d) => d.kind === "box");

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-2 md:flex-row">
        <div
          role="toolbar"
          aria-label="Drawing tools"
          className="flex shrink-0 flex-row gap-1 overflow-x-auto rounded-lg border border-border bg-[#141722] p-1 md:flex-col md:overflow-visible"
        >
          {TOOLS.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={tool === id}
              title={hint ? `${label} (${hint})` : label}
              onClick={() => manager?.setTool(tool === id ? null : id)}
              className={`${button} ${tool === id ? "bg-[#2962ff] text-white hover:bg-[#2962ff]" : ""}`}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
          <div className="mx-1 w-px shrink-0 bg-border md:mx-0 md:my-1 md:h-px md:w-auto" />
          <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" onClick={() => manager?.undo()} className={button}>
            <Undo2 className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={() => manager?.redo()} className={button}>
            <Redo2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={hidden ? "Show drawings" : "Hide drawings"}
            title={hidden ? "Show drawings" : "Hide drawings"}
            onClick={toggleHidden}
            className={button}
          >
            {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          <button type="button" aria-label="Clear all" title="Clear all (undoable)" onClick={() => manager?.clear()} className={button}>
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
        <div
          id="chart"
          ref={chartRef}
          className="relative h-[min(70vh,640px)] min-w-0 flex-1 overflow-hidden rounded-lg border border-border"
        />
      </div>

      {selection.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-[#141722] px-3 py-2 text-sm">
          <span className="text-muted-foreground">{selection.length} selected</span>
          <div className="flex gap-1" aria-label="Colour">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => manager?.setStyle({ color: c, borderColor: c })}
                className="h-5 w-5 rounded-full border border-white/30"
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex gap-1" aria-label="Width">
            {WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => manager?.setStyle({ width: w, borderWidth: w })}
                className="rounded px-2 py-0.5 text-gray-300 hover:bg-white/10"
              >
                {w}px
              </button>
            ))}
          </div>
          <div className="flex gap-1" aria-label="Line style">
            {PATTERNS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => manager?.setStyle({ pattern: p })}
                className="rounded px-2 py-0.5 capitalize text-gray-300 hover:bg-white/10"
              >
                {p}
              </button>
            ))}
          </div>
          {hasBox && (
            <div className="flex items-center gap-1" aria-label="Fill">
              <span className="text-muted-foreground">Fill</span>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Fill ${c}`}
                  onClick={() => manager?.setStyle({ bgColor: c })}
                  className="h-5 w-5 rounded border border-white/30"
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => manager?.deleteSelected()}
            className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-red-400 hover:bg-white/10"
          >
            <X className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Replace `src/app/page.tsx`**

```tsx
import DrawingDemo from "@/showcase/DrawingDemo";

const NPM_URL = "https://www.npmjs.com/package/@vecordis/lightweight-plugins";
const GITHUB_URL = "https://github.com/Effanuel/lightweight-plugins/tree/master/packages/lightweight-plugins";

const SHORTCUTS: [string, string][] = [
  ["Delete / Backspace", "delete the selection"],
  ["Escape", "cancel, disarm, deselect"],
  ["Ctrl+Z", "undo"],
  ["Ctrl+Shift+Z or Ctrl+Y", "redo"],
  ["Ctrl+C / Ctrl+V", "copy / paste"],
  ["Ctrl+drag", "marquee-select"],
  ["Alt+drag", "duplicate while dragging"],
  ["Right-click", "cancel the current drawing"],
];

const USAGE = `import { createChart, CandlestickSeries } from 'lightweight-charts';
import { DrawingManager } from '@vecordis/lightweight-plugins';

const chart = createChart(container);
const series = chart.addSeries(CandlestickSeries);
series.setData(candles); // times as UTCTimestamp seconds

const drawings = new DrawingManager(chart, series);
drawings.setTool('trend');                 // then click twice on the chart
drawings.on('change', () => save(drawings.getDrawings()));
drawings.setDrawings(load());              // restore saved drawings`;

export default function Home() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="break-all font-mono text-2xl font-bold">@vecordis/lightweight-plugins</h1>
          <p className="text-muted-foreground">Drawing tools for TradingView Lightweight Charts v5.</p>
          <pre className="w-fit max-w-full overflow-x-auto rounded bg-black/40 px-3 py-2 text-sm">
            <code>pnpm add @vecordis/lightweight-plugins lightweight-charts</code>
          </pre>
          <nav className="flex gap-4 text-sm">
            <a href={NPM_URL} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
              npm
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
              GitHub
            </a>
          </nav>
        </header>

        <p className="hidden rounded border border-border px-3 py-2 text-sm text-muted-foreground pointer-coarse:block">
          Drawing needs a mouse; on a touch screen you can look at the drawings but not make new ones.
        </p>

        <DrawingDemo />

        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-2 font-semibold">Shortcuts</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {SHORTCUTS.map(([key, what]) => (
                <div key={key} className="contents">
                  <dt className="font-mono text-gray-300">{key}</dt>
                  <dd className="text-muted-foreground">{what}</dd>
                </div>
              ))}
            </dl>
          </div>
          <details className="min-w-0 text-sm">
            <summary className="mb-2 cursor-pointer font-semibold">Usage</summary>
            <pre className="overflow-x-auto rounded bg-black/40 p-3 text-xs">
              <code>{USAGE}</code>
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Remove the TradingView plugins and the old showcase**

```bash
git rm -r -q $P/plugins $P/helpers src/showcase/demos.ts src/showcase/PluginCard.tsx
```

(If Task 3 found no copied code: also `git rm -q packages/lightweight-plugins/NOTICE`, and drop `"NOTICE"` from `files` in `packages/lightweight-plugins/package.json`.)

Replace `$P/index.ts` with only the block Task 7 Step 3 appended. In `test/smoke.mjs`, set `EXPECTED` to `['DEFAULT_BOX_STYLE', 'DEFAULT_DRAWING_STYLE', 'DEFAULT_FIB_LEVELS', 'DrawingManager']`. In `eslint.config.mjs`, delete the `vendored` const, its comment, and `...vendored,`.

In `packages/lightweight-plugins/package.json`: `"version": "0.2.0"`, `"description": "Mouse-driven drawing tools for TradingView lightweight-charts v5"`, `"keywords": ["lightweight-charts", "tradingview", "charts", "drawing", "drawing-tools", "trendline"]`.

- [ ] **Step 7: Rewrite the READMEs**

`packages/lightweight-plugins/README.md`:

~~~markdown
# @vecordis/lightweight-plugins

Mouse-driven drawing tools for [TradingView Lightweight Charts™](https://github.com/tradingview/lightweight-charts) v5: horizontal line, horizontal ray, vertical line, trend line, box, Fibonacci, path, free draw and measure, with selection, dragging, undo/redo, copy/paste and marquee select. No framework required.

Demo: https://lightweight-plugins.vercel.app/

## Install

```sh
pnpm add @vecordis/lightweight-plugins lightweight-charts
```

`lightweight-charts` `^5.0.0` is a peer dependency. The package is ESM-only.

## Usage

```ts
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { DrawingManager } from '@vecordis/lightweight-plugins';

const chart = createChart(container);
const series = chart.addSeries(CandlestickSeries);
series.setData(candles); // times must be UTCTimestamp (seconds)

const drawings = new DrawingManager(chart, series);
drawings.setTool('trend'); // the user clicks twice on the chart
```

Tools: `'select' | 'h-line' | 'h-ray' | 'v-line' | 'trend' | 'box' | 'fibonacci' | 'path' | 'free-draw' | 'measure'`.

| Member | |
|---|---|
| `new DrawingManager(chart, series, { tickSize?, keyboard? })` | `tickSize` defaults to the series' `priceFormat.minMove`; `keyboard` (default `true`) enables the shortcuts below |
| `setTool(tool \| null)`, `getTool()` | arm / disarm a tool |
| `getDrawings()`, `setDrawings(list)` | serializable drawings (`{ kind, id, …, style }`); `setDrawings` replaces all, clears undo history, and throws on an unknown kind or a bad/duplicate id |
| `clear()`, `setHidden(b)`, `isHidden()` | clear all (undoable), hide/show |
| `getSelection()`, `setStyle(patch)`, `deleteSelected()` | style keys are `color width pattern opacity` for lines, `borderColor borderWidth borderOpacity bgColor bgOpacity` for boxes |
| `setToolStyle(tool, patch)` | style for that tool's next drawings |
| `undo()`, `redo()`, `copy()`, `paste()` | |
| `on('change' \| 'toolChange' \| 'selectionChange', cb)` | returns an unsubscribe function |
| `destroy()` | detaches everything |

Saving drawings is up to you, e.g. `drawings.on('change', () => localStorage.setItem('d', JSON.stringify(drawings.getDrawings())))`.

## Mouse and keyboard

One click places a horizontal line, ray or vertical line; trend, box, Fibonacci and measure take two clicks; path takes a click per point and finishes on a click near the last one; free draw is press-drag-release (Escape to stop). Drag a drawing to move it, drag a handle to reshape, Alt+drag to duplicate. Ctrl/Cmd+drag or the `select` tool marquee-selects. Delete/Backspace, Escape, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y, Ctrl/Cmd+C/V work for the chart that was clicked last. Touch input is not supported.

## License

Apache-2.0.
~~~

(If Task 3 kept `NOTICE`, end with "Apache-2.0. See [NOTICE](./NOTICE).")

Root `README.md`:

~~~markdown
# lightweight-plugins

Source of [`@vecordis/lightweight-plugins`](./packages/lightweight-plugins), mouse-driven drawing tools for TradingView Lightweight Charts™ v5, and of the site that demos them: https://lightweight-plugins.vercel.app/

### Run

```sh
pnpm install
pnpm dev     # builds the plugins package, then starts Next.js
```

`pnpm build` and `pnpm start` run a production build. `/cvd` is a separate Binance cumulative volume delta demo.
~~~

- [ ] **Step 8: Build, lint, test**

Run: `pnpm install && pnpm build && pnpm lint && pnpm -F @vecordis/lightweight-plugins test`
Expected: all pass; smoke prints `smoke ok: 4 exports, lightweight-charts external`. Lint errors in `packages/lightweight-plugins/src` (now linted) are fixed in the file, not ignored; warnings in pre-existing `/cvd` files are not this task's.

Run: `grep -rnE 'AnchoredText|BandsIndicator|TrendLine\b|HeatMapSeries|PluginCard|demos' src packages/lightweight-plugins/src packages/lightweight-plugins/test`
Expected: no output.

- [ ] **Step 9: Run the browser check**

Run: `$SCRATCH/drawings-check/run.sh`
Expected: every line `ok`, then `PASS`.

- [ ] **Step 10: Inspect the screenshots**

Read `$SCRATCH/drawings-check/drawings-1280.png`, `drawings-1024.png`, `drawings-390.png`. Confirm: toolbar left of the chart at 1280/1024 and above it at 390; the four seeded drawings and the added ones are visible; the armed/selected states and the style bar are legible on the dark background; nothing overflows. Fix and re-run Steps 8–9 for any failure.

- [ ] **Step 11: Commit**

```bash
git add $P/index.ts packages/lightweight-plugins/package.json packages/lightweight-plugins/test/smoke.mjs \
  packages/lightweight-plugins/README.md README.md eslint.config.mjs pnpm-lock.yaml \
  src/app/page.tsx src/showcase/DrawingDemo.tsx src/showcase/tool-icons.tsx src/showcase/seed-drawings.ts src/showcase/sample-data.ts
git commit -m "feat!: drawing tools replace the TradingView example plugins (0.2.0)

The package now exports DrawingManager and its types; the 14 example
plugins are removed. The site demos the drawing tools on one chart.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git rm` in Step 6 staged the deletions.)
