# Plugin Showcase Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/` with a card grid that renders all 14 `@vecordis/lightweight-plugins` exports live, and delete the position tool, the orderflow/rounded-candles page and the live-chart plumbing.

**Architecture:** The app depends on the workspace package (`workspace:*`); `dev`/`build` build the package's `dist/` first. A client page maps a static `demos` array to `PluginCard`s; each card creates a lightweight-charts chart and runs its demo's `setup(chart)`, ported from TradingView's upstream examples, on seeded sample data.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, lightweight-charts 5.2, pnpm workspaces; Playwright (scratchpad only) for verification.

**Spec:** `docs/superpowers/specs/2026-10-01-plugin-showcase-design.md`

**Working directory:** worktree `/home/vecordis/GitHub/lightweight-plugins-showcase`, branch `feat/plugin-showcase`. All paths below are relative to it.

## Global Constraints

- Package import name: `@vecordis/lightweight-plugins`, dependency spec `workspace:*`.
- Showcase exactly the 14 package exports, in the package README table's order.
- Grid: 1 column by default, 2 at `md`, 3 at `lg`. Chart height 260px, options from `src/components/Chart/chart-options.ts` (`ChartOptions`).
- Sample data is generated from a seeded PRNG — no `Math.random()` in `src/showcase/`.
- `/cvd` keeps working. Do not touch `src/components/OrderPanel/` or `src/data.ts`.
- Code style (`.prettierrc`, existing files): double quotes, 2-space indent, semicolons, max line 120.
- No new app dependencies besides the workspace package. Playwright lives only in the scratchpad.
- Stage files by explicit path. Never `git add -A`, `git add .` or `git commit -a`.
- Commit messages: conventional commits, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Phone width (390px):** long usage snippets or the install line must not cause horizontal page scroll → `check.mjs` asserts `scrollWidth <= viewport width` (Task 2).
2. **Mouse over charts:** crosshair-driven plugins (`CrosshairHighlightPrimitive`, `UserPriceLines`) run code on every move and can throw from the render loop → `check.mjs` hovers every chart and asserts no page/console errors (Task 2).
3. **Resizing across breakpoints:** `autoSize` charts must follow the card width without errors → `check.mjs` resizes 1280→390 on the same page and re-checks (Task 2).
4. **Fresh clone without `packages/lightweight-plugins/dist`:** `pnpm build` must build the package first → Task 1 deletes `dist/` before building.
5. **Legibility on the dark background:** upstream defaults (black lines, dark purple whiskers) vanish on `#141722` → demos pass light colours; Task 2 has a screenshot checklist.

---

### Task 1: Wire the plugins package into the app

**Files:**
- Modify: `package.json` (scripts, dependencies)
- Modify: `pnpm-lock.yaml` (via pnpm)

**Interfaces:**
- Produces: `import { … } from "@vecordis/lightweight-plugins"` resolves in the app; `pnpm dev` and `pnpm build` build the package first.

- [ ] **Step 1: Install and confirm the app can't import the package yet**

```bash
pnpm install
node -e "import('@vecordis/lightweight-plugins').then(m => console.log(Object.keys(m).length))"
```
Expected: `ERR_MODULE_NOT_FOUND` (or "Cannot find package '@vecordis/lightweight-plugins'").

- [ ] **Step 2: Add the workspace dependency**

```bash
pnpm add -w "@vecordis/lightweight-plugins@workspace:*"
```
Expected: root `package.json` `dependencies` gains `"@vecordis/lightweight-plugins": "workspace:*"`.

- [ ] **Step 3: Build the package before Next**

In root `package.json` `scripts`, replace the `dev` and `build` lines:

```json
    "dev": "pnpm build:plugins && next dev --turbopack",
    "build": "pnpm build:plugins && next build",
```

- [ ] **Step 4: Verify from a state with no `dist/`**

```bash
rm -rf packages/lightweight-plugins/dist
pnpm build
node -e "import('@vecordis/lightweight-plugins').then(m => console.log(Object.keys(m).sort().join(' ')))"
```
Expected: tsup output, then `next build` succeeds; the node line prints
`AnchoredText BackgroundShadeSeries BandsIndicator CrosshairHighlightPrimitive GroupedBarsSeries HeatMapSeries LollipopSeries OverlayPriceScale PartialPriceLine SessionHighlighting TrendLine UserPriceLines VolumeProfile WhiskerBoxSeries`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: app depends on workspace plugins package

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Showcase page

**Files:**
- Create: `src/showcase/sample-data.ts`
- Create: `src/showcase/demos.ts`
- Create: `src/showcase/PluginCard.tsx`
- Replace: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Test (scratchpad, not committed): `$SCRATCH/showcase-check/check.mjs`, where
  `SCRATCH=/tmp/claude-1000/-home-vecordis-GitHub-lightweight-plugins/6ed9957d-b624-4877-a751-e474017dd25e/scratchpad`

**Interfaces:**
- Consumes: Task 1's package import.
- Produces:
  - `sample-data.ts`: `day(i: number): UTCTimestamp`, `lineData(count = 150, seed = 1): LineData[]`, `candleData(count = 150, seed = 2): CandlestickData[]`, `heatmapData(count = 40, seed = 3): HeatMapData[]`, `whiskerData(count = 40, seed = 4): WhiskerData[]`, `groupedBarsData(count = 40, groups = 3, seed = 5): GroupedBarsData[]`.
  - `demos.ts`: `type DemoKind = "primitive" | "tool" | "custom series"`, `interface Demo { name; kind; description; code; sourceUrl; setup(chart: IChartApi): void }`, `const demos: Demo[]` (14 entries).
  - `PluginCard.tsx`: default export `PluginCard({ demo }: { demo: Demo })`, renders one `<article>` per demo.

- [ ] **Step 1: Set up the Playwright check**

```bash
SCRATCH=/tmp/claude-1000/-home-vecordis-GitHub-lightweight-plugins/6ed9957d-b624-4877-a751-e474017dd25e/scratchpad
mkdir -p $SCRATCH/showcase-check && cd $SCRATCH/showcase-check
npm init -y >/dev/null && npm i playwright@1.59.1 && npx playwright install chromium
```

Create `$SCRATCH/showcase-check/check.mjs`:

```js
import { chromium } from "playwright";

const url = process.env.URL ?? "http://localhost:3100/";
const outDir = new URL(".", import.meta.url).pathname;
const browser = await chromium.launch();
let failed = false;

async function inspect(page, label, width, errors) {
  const cards = await page.locator("article").count();
  const withCanvas = await page.locator("article:has(canvas)").count();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.screenshot({ path: `${outDir}showcase-${label}.png`, fullPage: true });
  console.log(`${label}: cards=${cards} withCanvas=${withCanvas} scrollWidth=${scrollWidth} errors=${errors.length}`);
  errors.forEach((e) => console.log("  error:", e));
  if (cards !== 14 || withCanvas !== 14 || scrollWidth > width || errors.length) failed = true;
}

for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "networkidle" });

  // Hover every chart so crosshair-driven plugins run their move handlers.
  // The second move lands near the right price scale, where UserPriceLines shows its "+" label.
  for (const chart of await page.locator('article div[class*="h-[260px]"]').all()) {
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.boundingBox();
    if (!box) continue;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width - 60, box.y + box.height / 2);
  }
  await inspect(page, `${width}`, width, errors);

  if (width === 1280) {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(500);
    await inspect(page, "1280-resized-390", 390, errors);
  }
  await page.close();
}

await browser.close();
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run the check against the current home page to see it fail**

```bash
cd /home/vecordis/GitHub/lightweight-plugins-showcase && pnpm build && (pnpm exec next start -p 3100 > $SCRATCH/server.log 2>&1 &)
curl -s --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:3100/ && node $SCRATCH/showcase-check/check.mjs; pkill -f "next start -p 3100"
```
Expected: `cards=0 withCanvas=0` lines and `FAIL`.

- [ ] **Step 3: Write `src/showcase/sample-data.ts`**

```ts
import type { CandlestickData, LineData, UTCTimestamp } from "lightweight-charts";
import type { GroupedBarsData, HeatMapData, WhiskerData } from "@vecordis/lightweight-plugins";

const DAY = 24 * 60 * 60;
const START = Date.UTC(2024, 0, 1) / 1000;

// ponytail: mulberry32, a tiny seeded PRNG so every page load draws the same charts.
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const day = (i: number) => (START + i * DAY) as UTCTimestamp;

export function lineData(count = 150, seed = 1): LineData[] {
  const rand = rng(seed);
  let value = 100;
  return Array.from({ length: count }, (_, i) => {
    value = Math.max(10, value + (rand() - 0.48) * 4);
    return { time: day(i), value };
  });
}

export function candleData(count = 150, seed = 2): CandlestickData[] {
  const rand = rng(seed);
  let close = 100;
  return Array.from({ length: count }, (_, i) => {
    const open = close;
    close = Math.max(10, open + (rand() - 0.48) * 4);
    const high = Math.max(open, close) + rand() * 2;
    const low = Math.min(open, close) - rand() * 2;
    return { time: day(i), open, high, low, close };
  });
}

// Ten 10-wide price bands per bar; amounts (0-100) peak around a drifting centre band.
export function heatmapData(count = 40, seed = 3): HeatMapData[] {
  const rand = rng(seed);
  let centre = 5;
  return Array.from({ length: count }, (_, i) => {
    centre = Math.min(8, Math.max(1, centre + (rand() - 0.5)));
    return {
      time: day(i),
      cells: Array.from({ length: 10 }, (_, band) => ({
        low: band * 10,
        high: band * 10 + 10,
        amount: 100 * Math.exp(-((band - centre) ** 2) / 4) * (0.7 + 0.3 * rand()),
      })),
    };
  });
}

export function whiskerData(count = 40, seed = 4): WhiskerData[] {
  const rand = rng(seed);
  let base = 50;
  return Array.from({ length: count }, (_, i): WhiskerData => {
    base += (rand() - 0.5) * 6;
    const q = Array.from({ length: 5 }, () => base + (rand() - 0.5) * 30).sort((a, b) => a - b);
    const outliers = rand() < 0.2 ? [q[0] - 5 - rand() * 5, q[4] + 5 + rand() * 5] : undefined;
    return { time: day(i), quartiles: [q[0], q[1], q[2], q[3], q[4]], outliers };
  });
}

export function groupedBarsData(count = 40, groups = 3, seed = 5): GroupedBarsData[] {
  const rand = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    time: day(i),
    values: Array.from({ length: groups }, () => 20 + rand() * 80),
  }));
}
```

- [ ] **Step 4: Write `src/showcase/demos.ts`**

Each `setup` ports the upstream `plugin-examples/src/plugins/<dir>/example/example.ts` at lightweight-charts `v5.2.1`, with light colours for the dark chart. `code` is what the card shows users; it uses single quotes like the package README.

```ts
import { CandlestickSeries, LineSeries, type IChartApi, type Time, type UTCTimestamp } from "lightweight-charts";
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
} from "@vecordis/lightweight-plugins";
import { candleData, groupedBarsData, heatmapData, lineData, whiskerData } from "./sample-data";

export type DemoKind = "primitive" | "tool" | "custom series";

export interface Demo {
  name: string;
  kind: DemoKind;
  description: string;
  /** Usage snippet shown on the card. */
  code: string;
  sourceUrl: string;
  setup: (chart: IChartApi) => void;
}

const source = (dir: string) =>
  `https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/${dir}`;

const isWeekend = (time: Time) => [0, 6].includes(new Date((time as UTCTimestamp) * 1000).getUTCDay());

export const demos: Demo[] = [
  {
    name: "AnchoredText",
    kind: "primitive",
    description: "Text anchored to a fixed spot in the pane, e.g. a watermark.",
    sourceUrl: source("anchored-text"),
    code: `import { AnchoredText } from '@vecordis/lightweight-plugins';

series.attachPrimitive(
  new AnchoredText({
    text: 'Anchored Text',
    vertAlign: 'middle',
    horzAlign: 'middle',
    font: 'italic bold 32px Arial',
    lineHeight: 32,
    color: 'rgba(255, 255, 255, 0.3)',
  }),
);`,
    setup: (chart) => {
      const series = chart.addSeries(LineSeries);
      series.setData(lineData());
      series.attachPrimitive(
        new AnchoredText({
          text: "Anchored Text",
          vertAlign: "middle",
          horzAlign: "middle",
          font: "italic bold 32px Arial",
          lineHeight: 32,
          color: "rgba(255, 255, 255, 0.3)",
        }),
      );
    },
  },
  {
    name: "BandsIndicator",
    kind: "primitive",
    description: "Upper and lower bands (±10% of each value) around the series, with a filled area.",
    sourceUrl: source("bands-indicator"),
    code: `import { BandsIndicator } from '@vecordis/lightweight-plugins';

series.attachPrimitive(new BandsIndicator({ lineColor: 'rgb(25, 200, 100)', lineWidth: 1 }));`,
    setup: (chart) => {
      const series = chart.addSeries(LineSeries);
      series.setData(lineData());
      series.attachPrimitive(new BandsIndicator());
    },
  },
  {
    name: "CrosshairHighlightPrimitive",
    kind: "primitive",
    description: "Highlights the bar under the crosshair. Hover the chart.",
    sourceUrl: source("highlight-bar-crosshair"),
    code: `import { CrosshairHighlightPrimitive } from '@vecordis/lightweight-plugins';

// Switches the crosshair to Normal mode and hides its vertical line.
series.attachPrimitive(new CrosshairHighlightPrimitive({ color: 'rgba(255, 255, 255, 0.1)' }));`,
    setup: (chart) => {
      const series = chart.addSeries(CandlestickSeries);
      series.setData(candleData());
      series.attachPrimitive(new CrosshairHighlightPrimitive({ color: "rgba(255, 255, 255, 0.1)" }));
    },
  },
  {
    name: "OverlayPriceScale",
    kind: "primitive",
    description: "A price scale drawn as an overlay inside the pane.",
    sourceUrl: source("overlay-price-scale"),
    code: `import { OverlayPriceScale } from '@vecordis/lightweight-plugins';

const series = chart.addSeries(LineSeries, { priceScaleId: 'overlay' });
series.attachPrimitive(new OverlayPriceScale({ side: 'left' }));`,
    setup: (chart) => {
      chart.applyOptions({ rightPriceScale: { visible: false }, grid: { horzLines: { visible: false } } });
      const series = chart.addSeries(LineSeries, { priceScaleId: "overlay" });
      series.setData(lineData());
      series.attachPrimitive(
        new OverlayPriceScale({ textColor: "rgb(220, 220, 220)", backgroundColor: "rgba(20, 23, 34, 0.6)" }),
      );
    },
  },
  {
    name: "PartialPriceLine",
    kind: "primitive",
    description: "Last-value price line that spans only part of the pane.",
    sourceUrl: source("partial-price-line"),
    code: `import { PartialPriceLine } from '@vecordis/lightweight-plugins';

// Draws from the last bar to the price scale, so leave room on the right.
chart.timeScale().applyOptions({ rightOffset: 10 });
series.attachPrimitive(new PartialPriceLine());`,
    setup: (chart) => {
      chart.timeScale().applyOptions({ rightOffset: 10 });
      const series = chart.addSeries(LineSeries);
      series.setData(lineData());
      series.attachPrimitive(new PartialPriceLine());
    },
  },
  {
    name: "SessionHighlighting",
    kind: "primitive",
    description: "Colours each bar's background from a callback; here weekends vs weekdays.",
    sourceUrl: source("session-highlighting"),
    code: `import { SessionHighlighting } from '@vecordis/lightweight-plugins';

series.attachPrimitive(
  new SessionHighlighting((time) => (isWeekend(time) ? 'rgba(255, 152, 1, 0.15)' : 'rgba(41, 98, 255, 0.15)')),
);`,
    setup: (chart) => {
      const series = chart.addSeries(CandlestickSeries);
      series.setData(candleData());
      series.attachPrimitive(
        new SessionHighlighting((time) => (isWeekend(time) ? "rgba(255, 152, 1, 0.15)" : "rgba(41, 98, 255, 0.15)")),
      );
    },
  },
  {
    name: "TrendLine",
    kind: "primitive",
    description: "Line between two time/price points, with optional price labels.",
    sourceUrl: source("trend-line"),
    code: `import { TrendLine } from '@vecordis/lightweight-plugins';

series.attachPrimitive(
  new TrendLine(chart, series, { time: t1, price: 95 }, { time: t2, price: 120 }, { lineColor: '#FF9800', width: 2 }),
);`,
    setup: (chart) => {
      const series = chart.addSeries(LineSeries);
      const data = lineData();
      series.setData(data);
      const [a, b] = [data[data.length - 40], data[data.length - 5]];
      series.attachPrimitive(
        new TrendLine(
          chart,
          series,
          { time: a.time, price: a.value * 0.95 },
          { time: b.time, price: b.value * 1.05 },
          { lineColor: "#FF9800", width: 2, labelBackgroundColor: "rgba(20, 23, 34, 0.85)", labelTextColor: "white" },
        ),
      );
    },
  },
  {
    name: "UserPriceLines",
    kind: "tool",
    description: 'Hover the right price scale and click the "+" button to add a price line.',
    sourceUrl: source("user-price-lines"),
    code: `import { UserPriceLines } from '@vecordis/lightweight-plugins';

// Attaches itself: don't pass it to attachPrimitive. Call .remove() to clean up.
const tool = new UserPriceLines(chart, series, { color: 'hotpink' });`,
    setup: (chart) => {
      const series = chart.addSeries(LineSeries);
      series.setData(lineData());
      new UserPriceLines(chart, series, { color: "hotpink" });
    },
  },
  {
    name: "VolumeProfile",
    kind: "primitive",
    description: "Volume-at-price histogram anchored to a point in time.",
    sourceUrl: source("volume-profile"),
    code: `import { VolumeProfile } from '@vecordis/lightweight-plugins';

const profile = [{ price: 98, vol: 4 }, { price: 100, vol: 12 }, { price: 102, vol: 7 }];
series.attachPrimitive(new VolumeProfile(chart, series, { time, profile, width: 10 }));`,
    setup: (chart) => {
      const series = chart.addSeries(CandlestickSeries);
      const data = candleData();
      series.setData(data);
      const anchor = data[data.length - 30];
      const step = anchor.close * 0.01;
      const profile = Array.from({ length: 15 }, (_, i) => ({
        price: anchor.close + (i - 7) * step,
        vol: Math.round(20 * Math.exp(-((i - 7) ** 2) / 12)),
      }));
      series.attachPrimitive(new VolumeProfile(chart, series, { time: anchor.time, profile, width: 10 }));
    },
  },
  {
    name: "BackgroundShadeSeries",
    kind: "custom series",
    description: "Shades the background between two colours by value.",
    sourceUrl: source("background-shade-series"),
    code: `import { BackgroundShadeSeries } from '@vecordis/lightweight-plugins';

// data: { time, value }[]
chart.addCustomSeries(new BackgroundShadeSeries(), { lowValue: 0, highValue: 200 }).setData(data);
chart.addSeries(LineSeries).setData(data);`,
    setup: (chart) => {
      const data = lineData();
      const values = data.map((d) => d.value);
      chart
        .addCustomSeries(new BackgroundShadeSeries(), {
          lowValue: Math.min(...values),
          highValue: Math.max(...values),
          opacity: 0.4,
        })
        .setData(data);
      chart.addSeries(LineSeries, { color: "white" }).setData(data);
    },
  },
  {
    name: "WhiskerBoxSeries",
    kind: "custom series",
    description: "Box-and-whisker (quartiles) plot per bar.",
    sourceUrl: source("box-whisker-series"),
    code: `import { WhiskerBoxSeries } from '@vecordis/lightweight-plugins';

// data: { time, quartiles: [min, q1, median, q3, max], outliers? }[]
chart.addCustomSeries(new WhiskerBoxSeries(), { priceLineVisible: false }).setData(data);`,
    setup: (chart) => {
      chart
        .addCustomSeries(new WhiskerBoxSeries(), {
          baseLineColor: "",
          priceLineVisible: false,
          lastValueVisible: false,
          whiskerColor: "rgba(186, 104, 200, 1)",
        })
        .setData(whiskerData());
    },
  },
  {
    name: "GroupedBarsSeries",
    kind: "custom series",
    description: "Several bars side by side per time point.",
    sourceUrl: source("grouped-bars-series"),
    code: `import { GroupedBarsSeries } from '@vecordis/lightweight-plugins';

// data: { time, values: number[] }[]
chart.addCustomSeries(new GroupedBarsSeries(), { colors: ['#2962FF', '#E1575A', '#F28E2C'] }).setData(data);`,
    setup: (chart) => {
      chart.applyOptions({ timeScale: { barSpacing: 16, minBarSpacing: 8 } });
      chart.addCustomSeries(new GroupedBarsSeries(), { color: "white" }).setData(groupedBarsData());
    },
  },
  {
    name: "HeatMapSeries",
    kind: "custom series",
    description: "Heatmap cells over price ranges per bar.",
    sourceUrl: source("heatmap-series"),
    code: `import { HeatMapSeries } from '@vecordis/lightweight-plugins';

// data: { time, cells: { low, high, amount }[] }[]
// Colour cells yourself with the cellShader option: (amount) => cssColor.
chart.addCustomSeries(new HeatMapSeries()).setData(data);`,
    setup: (chart) => {
      chart.applyOptions({ timeScale: { barSpacing: 10 } });
      chart.addCustomSeries(new HeatMapSeries()).setData(heatmapData());
    },
  },
  {
    name: "LollipopSeries",
    kind: "custom series",
    description: "Lollipop chart: a stem and a dot per value.",
    sourceUrl: source("lollipop-series"),
    code: `import { LollipopSeries } from '@vecordis/lightweight-plugins';

// data: { time, value }[]
chart.addCustomSeries(new LollipopSeries(), { lineWidth: 2 }).setData(data);`,
    setup: (chart) => {
      chart.addCustomSeries(new LollipopSeries(), { lineWidth: 2 }).setData(lineData(60, 7));
    },
  },
];
```

- [ ] **Step 5: Write `src/showcase/PluginCard.tsx`**

The error path writes to DOM the effect owns instead of calling `setState`: `react-hooks/set-state-in-effect` (enabled by `eslint-config-next`) rejects a synchronous `setState` in an effect, including inside `catch`.

```tsx
"use client";

import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { Badge } from "@/components/ui/badge";
import { ChartOptions } from "@/components/Chart/chart-options";
import type { Demo } from "./demos";

export default function PluginCard({ demo }: { demo: Demo }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const chartEl = chartRef.current;
    const errorEl = errorRef.current;
    if (!chartEl || !errorEl) return;

    const chart = createChart(chartEl, ChartOptions);
    try {
      demo.setup(chart);
    } catch (error) {
      console.error(`${demo.name} demo failed`, error);
      chartEl.hidden = true;
      errorEl.textContent = `Failed to render: ${error instanceof Error ? error.message : String(error)}`;
      errorEl.hidden = false;
    }
    return () => chart.remove();
  }, [demo]);

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-[#141722] p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="truncate font-mono text-sm font-semibold">{demo.name}</h2>
        <Badge variant="secondary">{demo.kind}</Badge>
      </header>
      <p className="text-sm text-muted-foreground">{demo.description}</p>
      <div ref={chartRef} className="relative h-[260px] w-full" />
      <p ref={errorRef} hidden className="py-24 text-center text-sm text-red-400" />
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Usage</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-3 text-xs">
          <code>{demo.code}</code>
        </pre>
      </details>
      <a href={demo.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline">
        Source ↗
      </a>
    </article>
  );
}
```

- [ ] **Step 6: Replace `src/app/page.tsx`**

The page is a client component because each `Demo` carries a `setup` function, which can't cross the server→client boundary.

```tsx
"use client";

import PluginCard from "@/showcase/PluginCard";
import { demos } from "@/showcase/demos";

const NPM_URL = "https://www.npmjs.com/package/@vecordis/lightweight-plugins";
const GITHUB_URL = "https://github.com/Effanuel/lightweight-plugins/tree/master/packages/lightweight-plugins";

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-3">
          <h1 className="break-all font-mono text-2xl font-bold">@vecordis/lightweight-plugins</h1>
          <p className="text-muted-foreground">
            {demos.length} plugins for TradingView Lightweight Charts v5: series primitives, a price-line tool and
            custom series.
          </p>
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
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {demos.map((demo) => (
            <PluginCard key={demo.name} demo={demo} />
          ))}
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Drop the live-chart providers from `src/app/layout.tsx`**

Replace the whole file with:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lightweight plugins",
  description: "Plugins for TradingView lightweight-charts v5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Build and lint**

```bash
pnpm build && pnpm lint
```
Expected: both succeed, `/` listed as a static route.

- [ ] **Step 9: Run the check to see it pass**

```bash
(pnpm exec next start -p 3100 > $SCRATCH/server.log 2>&1 &)
curl -s --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:3100/ && node $SCRATCH/showcase-check/check.mjs; pkill -f "next start -p 3100"
```
Expected: three lines (`1280`, `1280-resized-390`, `390`), each with `cards=14 withCanvas=14 errors=0` and `scrollWidth` no larger than that viewport's width, then `PASS`.

- [ ] **Step 10: Inspect the screenshots**

Read `$SCRATCH/showcase-check/showcase-1280.png` and `showcase-390.png` and confirm:
- 3 columns at 1280, 1 column at 390.
- Every card shows its plugin, not just a bare series: watermark text, green bands, coloured weekday/weekend backgrounds, orange trend line with labels, volume histogram bars, shaded background, purple/pink boxes with whiskers, 3 bars per time point, green heatmap cells, lollipop stems. The overlay price scale labels are readable.
- No text or line is dark-on-dark.

Fix any demo that fails a point (colours in its `setup`), then re-run Steps 8–9.

- [ ] **Step 11: Commit**

```bash
git add src/showcase/sample-data.ts src/showcase/demos.ts src/showcase/PluginCard.tsx src/app/page.tsx src/app/layout.tsx
git commit -m "feat: home page showcases all 14 plugins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Delete position tool, rounded candles and live-chart code

**Files:**
- Delete: `src/plugins/` (whole dir), `src/hooks/usePositionPlugin.ts`, `assets/position-plugin.png`
- Delete: `src/app/orderflow/` (whole dir)
- Delete: `src/components/Chart/Chart.tsx`, `src/components/LoadingOverlayWrapper.tsx`, `src/components/LoadingIndicator/`, `src/components/ui/custom-select.tsx`
- Delete: `src/context/ChartContext.tsx`, `src/context/WebSocketContext.tsx`, `src/workers/`, `src/services/mexcApi.ts`, `src/app/api/mexc/`, `src/hooks/useMexcData.ts`, `src/hooks/useSymbols.ts`
- Modify: `package.json`, `pnpm-lock.yaml` (remove deps)
- Replace: `README.md`

**Interfaces:**
- Consumes: Task 2's page (no longer imports any of the deleted files).
- Produces: nothing new. `/orderflow` returns 404; `/cvd` unchanged.

- [ ] **Step 1: Confirm `/orderflow` still exists**

```bash
(pnpm exec next start -p 3100 > $SCRATCH/server.log 2>&1 &)
curl -s --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:3100/ && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/orderflow; pkill -f "next start -p 3100"
```
Expected: `200`.

- [ ] **Step 2: Delete the files**

```bash
git rm -r -q src/plugins src/hooks/usePositionPlugin.ts assets/position-plugin.png src/app/orderflow \
  src/components/Chart/Chart.tsx src/components/LoadingOverlayWrapper.tsx src/components/LoadingIndicator \
  src/components/ui/custom-select.tsx src/context/ChartContext.tsx src/context/WebSocketContext.tsx src/workers \
  src/services/mexcApi.ts src/app/api/mexc src/hooks/useMexcData.ts src/hooks/useSymbols.ts
```

- [ ] **Step 3: Remove dependencies nothing imports any more**

```bash
pnpm remove -w swr react-window worker-loader fancy-canvas \
  @tradingview/lwc-plugin-brushable-area-series @tradingview/lwc-plugin-hlc-area-series \
  @tradingview/lwc-plugin-image-watermark @tradingview/lwc-plugin-rounded-candles-series \
  @tradingview/lwc-plugin-stacked-area-series @tradingview/lwc-plugin-stacked-bars-series \
  @tradingview/lwc-plugin-vertical-line
```

- [ ] **Step 4: Confirm nothing references the deleted code or deps**

```bash
grep -rnE '@/context/|usePositionPlugin|position-plugin|orderflow|mexc|custom-select|LoadingIndicator|LoadingOverlayWrapper|from "swr"|react-window|worker-loader|fancy-canvas|lwc-plugin' src package.json
```
Expected: no output.

- [ ] **Step 5: Replace `README.md`**

~~~markdown
# lightweight-plugins

Source of [`@vecordis/lightweight-plugins`](./packages/lightweight-plugins), 14 plugins for TradingView Lightweight Charts™ v5, and of the site that showcases them: https://lightweight-plugins.vercel.app/

### Run

```sh
pnpm install
pnpm dev     # builds the plugins package, then starts Next.js
```

`pnpm build` and `pnpm start` run a production build. `/cvd` is a separate Binance cumulative volume delta demo.
~~~

- [ ] **Step 6: Verify build, lint, routes and the showcase**

```bash
pnpm build && pnpm lint
(pnpm exec next start -p 3100 > $SCRATCH/server.log 2>&1 &)
curl -s --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:3100/
curl -s -o /dev/null -w "orderflow %{http_code}\n" http://localhost:3100/orderflow
curl -s -o /dev/null -w "cvd %{http_code}\n" http://localhost:3100/cvd
node $SCRATCH/showcase-check/check.mjs; pkill -f "next start -p 3100"
```
Expected: build and lint succeed; `orderflow 404`, `cvd 200`; check prints the same three lines as Task 2 Step 9 and `PASS`.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml README.md
git commit -m "refactor: remove position tool, rounded candles and live chart

The home page no longer uses the MEXC live chart, so its contexts, worker,
API routes and hooks go too, along with dependencies nothing imports.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(The `git rm` in Step 2 already staged the deletions.)
