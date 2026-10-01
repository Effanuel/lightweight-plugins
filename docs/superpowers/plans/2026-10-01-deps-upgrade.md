# Dependency Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade every dependency to its latest version, majors included, with
`pnpm build` and `pnpm lint` green and the chart pages verified in a headless
browser.

**Architecture:** The upgrade runs as four stages, each its own commit and
each gated by type-check, build, lint and browser checks:
1. minor/patch bumps
2. toolchain
3. lightweight-charts 5
4. UI library majors

The browser gate is a throwaway Playwright script in the session scratchpad.
It runs against `pnpm start`, mocks the MEXC REST routes in the browser, and
asserts that every chart canvas actually drew. A baseline run on v4 (Task 3)
gives the v5 run something to compare against.

**Tech Stack:** Next.js 15 → 16, React 19.3, TypeScript 6.0, ESLint flat
config, lightweight-charts 4.2 → 5.2.1, pnpm, and Playwright (scratchpad
only).

**Spec:** `docs/superpowers/specs/2026-10-01-deps-upgrade-design.md`

## Global Constraints

- **TypeScript:** `typescript` is the newest 6.0.x (6.0.3 today) and never
  7.x. The reason is that typescript-eslint peers `>=4.8.4 <6.1.0` and TS 7
  dropped the JS compiler API.
- **ESLint:** `eslint` is 10.x. Fall back to the newest 9.x (9.39.5 today)
  only if `pnpm lint` crashes on 10, for example with a plugin
  `TypeError`/`context.*` error. Peer-dependency warnings alone are not a
  reason to fall back.
- **lightweight-charts:** `lightweight-charts` is `5.2.1`.
- **Official plugins:** the seven official plugins come from npm as
  `@tradingview/lwc-plugin-{brushable-area-series,hlc-area-series,image-watermark,rounded-candles-series,stacked-area-series,stacked-bars-series,vertical-line}`@latest.
- **Copied plugins:** the other 14 plugins, `src/plugins/plugin-base.ts` and
  `src/helpers/**` are copied verbatim from upstream tag `v5.2.1` and never
  hand-edited. They are excluded from ESLint.
- **Dependencies:** the only new dependencies are the seven
  `@tradingview/lwc-plugin-*` packages. Playwright never goes into
  `package.json`. Unused deps (`zod`, `@hookform/resolvers`, `date-fns`,
  `worker-loader`) are upgraded, not removed. The only removal is
  `@types/react-window`.
- **Commit messages,** one commit per stage, exactly:
  - `chore: bump minor/patch deps`
  - `chore: upgrade toolchain to Next 16 / ESLint flat config`
  - `feat: migrate to lightweight-charts 5`
  - `chore: upgrade UI library majors`

  Each ends with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Staging:** stage files by explicit path only. Never use `git add -A` or
  `git commit -a`.
- **Harness quirk (this session):**
  - Call git and grep as `/usr/bin/git` and `/usr/bin/grep`.
  - A worktree guard refuses one-line shell commands that contain loops,
    `$(...)`, brace expansion or a path containing `GitHub`. Put those in a
    script under the scratchpad and run them with `bash <script>`.
- **Stop and ask the user, instead of widening scope, if any of these
  happen:**
  - A version cap is needed beyond TypeScript/ESLint.
  - The first `pnpm lint` run reports more than 30 errors.
  - A chart regression can't be traced.
  - A fix would change runtime behaviour beyond what the upgrade requires.

Scratchpad root, referred to as `$SP` below:
`/tmp/claude-1000/-home-vecordis-GitHub-lightweight-plugins/573410cb-d7c7-45f9-9fc4-259bc88054ea/scratchpad`

Working directory for every command:
`/home/vecordis/GitHub/lightweight-plugins/.claude/worktrees/add-lwc-example-plugins`

## Review Focus

1. **Chart re-creation guard.** `ChartContext` and `useCvdCharts` refuse to
   create a second chart when the container already holds a
   `.tv-lightweight-charts` element. Each chart container must still hold
   exactly one chart root under v5. Pinned by the `roots === 1` assertion in
   `check.mjs` (Task 3), which runs in Tasks 3, 4 and 5.
2. **Symbol switch on `/`.** Choosing another symbol must re-fetch and
   `setData` on the existing v5 series, and the tab title must become
   `<price> | <symbol>`. Pinned by the select step in `check.mjs`.
3. **Whitespace bar in `/orderflow`.** `data[n-2]` is a `{ time }`-only point
   fed to the local custom rounded-candles series. Under v5 it must render
   with no `pageerror`. Pinned by the `/orderflow` visit in `check.mjs`.
4. **Production worker chunk.** `new Worker(new URL("../workers/mexcWebsocket.worker.ts", import.meta.url))`
   must be emitted and served by the Next 16 Turbopack production build.
   Pinned in `check.mjs` by the `requestfailed` and `response` listeners,
   which fail on any same-origin network failure or HTTP ≥ 400. The
   `Failed to create WebSocket worker` console error is deliberately not
   ignored.
5. **Virtualized `CustomSelect` path (react-window v2 port).** Both selects on
   `/` pass `virtualized={false}`, so no page renders the `List` branch. It
   can only be covered by `tsc` without changing app code, which is out of
   scope. Task 5 type-checks it, and the PR body flags it as unverified at
   runtime.

---

### Task 1: Minor/patch bumps (Stage 1)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: a lockfile with every non-major package at latest. Only these
  majors are left outdated:
  - `@types/node`, `@types/react-window`
  - `eslint`, `eslint-config-next`, `next`, `typescript`
  - `lightweight-charts`
  - `react-day-picker`, `react-resizable-panels`, `react-window`
  - `recharts`, `zod`, `lucide-react`

- [ ] **Step 1: Record the baseline type errors**

Run: `rtk proxy npx tsc --noEmit -p . 2>&1 | /usr/bin/grep 'error TS'`
Expected: exactly 2 lines, both in `src/app/orderflow/page.tsx` (17,67 and
54,27).

- [ ] **Step 2: Bump all non-major packages**

```bash
pnpm up --latest @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-context-menu @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-hover-card @radix-ui/react-label @radix-ui/react-menubar @radix-ui/react-navigation-menu @radix-ui/react-popover @radix-ui/react-progress @radix-ui/react-radio-group @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-tooltip @hookform/resolvers date-fns input-otp react react-dom react-hook-form sonner swr tailwind-merge @tailwindcss/postcss @types/react @types/react-dom postcss tailwindcss tw-animate-css
```

- [ ] **Step 3: Confirm only majors remain outdated**

Run: `rtk proxy pnpm outdated 2>&1 | /usr/bin/grep '│' | /usr/bin/grep -v Package`
Expected: exactly the 13 majors listed under **Produces**.

- [ ] **Step 4: Type-check gate**

Run: `rtk proxy npx tsc --noEmit -p . 2>&1 | /usr/bin/grep 'error TS'`
Expected: the same 2 `orderflow/page.tsx` lines as Step 1 and nothing else.
If new errors appear, fix them at the call site and re-run.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add package.json pnpm-lock.yaml
/usr/bin/git commit -q -m "chore: bump minor/patch deps" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Toolchain: Next 16, ESLint flat config, TS 6.0 (Stage 2)

**Files:**
- Modify: `package.json` (the `lint` script and versions), `pnpm-lock.yaml`
- Modify: `tsconfig.json`, only if `next build` rewrites it or TS 6 needs
  `"types": ["node"]` (Step 5)
- Delete: `.eslintrc.json`
- Create: `eslint.config.mjs`
- Modify: `src/app/orderflow/page.tsx:9-23,54`
- Modify: `src/hooks/useCvdCharts.tsx` (interface lines 18, 23, 27-30;
  `return … as any` lines 85, 103, 117, 127, 135, 143, 151, 207, 217, 232,
  240)

**Interfaces:**
- Consumes: the Task 1 lockfile.
- Produces:
  - `pnpm lint` (= `eslint .`) and `pnpm build`, both exit 0.
  - `eslint.config.mjs` exporting a `vendored` ignore list, which Task 4
    edits.
  - `useCvdCharts` creation functions with return type
    `ISeriesApi<…> | null`.

- [ ] **Step 1: Upgrade the toolchain packages**

```bash
pnpm add next@16.3.8
pnpm add -D eslint-config-next@16.3.8 eslint@latest typescript@~6.0.0 @types/node@latest
```

Expected: `package.json` shows `next` `16.3.8`, `eslint-config-next`
`16.3.8`, `eslint` `^10.x`, `typescript` `~6.0.3` and `@types/node`
`^26.x`. Peer warnings about ESLint 10 from `eslint-plugin-react`,
`eslint-plugin-import` or `eslint-plugin-jsx-a11y` are expected and fine.

- [ ] **Step 2: Replace the ESLint config**

```bash
/usr/bin/git rm -q .eslintrc.json
```

Create `eslint.config.mjs`:

```js
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
  "src/plugins/brushable-area-series/**",
  "src/plugins/grouped-bars-series/**",
  "src/plugins/heatmap-series/**",
  "src/plugins/highlight-bar-crosshair/**",
  "src/plugins/hlc-area-series/**",
  "src/plugins/image-watermark/**",
  "src/plugins/lollipop-series/**",
  "src/plugins/overlay-price-scale/**",
  "src/plugins/partial-price-line/**",
  "src/plugins/rounded-candles-series/**",
  "src/plugins/session-highlighting/**",
  "src/plugins/stacked-area-series/**",
  "src/plugins/stacked-bars-series/**",
  "src/plugins/trend-line/**",
  "src/plugins/user-price-lines/**",
  "src/plugins/vertical-line/**",
  "src/plugins/volume-profile/**",
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".claude/**", "node_modules/**", "next-env.d.ts", ...vendored]),
]);
```

In `package.json`, change `"lint": "next lint"` to `"lint": "eslint ."`.

- [ ] **Step 3: Fix the existing orderflow ref type errors**

In `src/app/orderflow/page.tsx`, replace lines 9–23:

```tsx
export default function OrderflowPage() {
  const chartDiv = React.useRef<IChartApi | null>(null);

  React.useEffect(() => {
    if (!chartDiv.current) {
      throw new Error("Chart div element doesnt exist");
    }

    const chart = ((window as unknown as any).chart = createChart(chartDiv.current!, {
      ...ChartOptions,
      height: 1000,
      width: 1000,
    }));

    chartDiv.current = chart;
```

with:

```tsx
export default function OrderflowPage() {
  const chartDiv = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!chartDiv.current) {
      throw new Error("Chart div element doesnt exist");
    }

    const chart = createChart(chartDiv.current, {
      ...ChartOptions,
      height: 1000,
      width: 1000,
    });
    (window as unknown as { chart?: IChartApi }).chart = chart;
```

Line 54 (`ref={chartDiv}`) now type-checks unchanged.

- [ ] **Step 4: Remove the `as any` returns in `useCvdCharts.tsx`**

In `src/hooks/useCvdCharts.tsx`, change the interface signatures:

```ts
  createTradeLineSeries: (data: LineData[], options?: CandlestickSeriesPartialOptions) => ISeriesApi<"Line"> | null;
```
```ts
  createCvdLineSeries: (data: LineData[], options?: CandlestickSeriesPartialOptions) => ISeriesApi<"Baseline"> | null;
```
```ts
  createCvdCandleSeries: (
    data: CandlestickData[],
    options?: CandlestickSeriesPartialOptions
  ) => ISeriesApi<"Candlestick"> | null;
```

Then append `| null` to the declared return type of every implementation
whose guard returns early:
- `createTradeLineSeries`, `createCvdLineSeries` and `createCvdCandleSeries`
  in `CvdChartProvider`.
- `createCandlesticks` and `createLineSeries` in `useChart`.

In those five functions, change each guard

```ts
      return console.warn("Failed to init line chart. Chart is undefined") as any;
```

to (same message text per site):

```ts
      console.warn("Failed to init line chart. Chart is undefined");
      return null;
```

In the six `update*` functions (`updateLine1`/`updateLine2` in both the
provider and `useChart`, plus `updateCvd` and `updateCvdCandle`), change each
guard

```ts
      return console.warn("Failed to update line chart. Series is undefined") as any;
```

to (same message text per site):

```ts
      console.warn("Failed to update line chart. Series is undefined");
      return;
```

All callers (`TradeLineChart`, `CvdLineChart`, `CvdCandleChart` and
`Chart.tsx`) ignore the return value, so behaviour is unchanged.

- [ ] **Step 5: Build gate**

Run: `rtk proxy pnpm build 2>&1 | tail -30`

Expected: `✓ Compiled successfully`, then type-check passes and the route
table prints.

- If `next build` rewrites `tsconfig.json` (for example `jsx` →
  `react-jsx`, or adds `.next/dev/types/**/*.ts` to `include`), keep those
  edits.
- If TS 6 reports `Cannot find name 'process'` or other Node globals, add
  `"types": ["node"]` to `compilerOptions` in `tsconfig.json` and re-run.

- [ ] **Step 6: Lint gate**

Run: `rtk proxy pnpm lint 2>&1 | tail -40`

- **Crash on ESLint 10** (a stack trace from a plugin, not lint findings):
  run `pnpm add -D eslint@^9`, note "ESLint capped at 9.x: <plugin> crashes
  on 10" for the PR, and re-run.
- **More than 30 errors** (the summary line `✖ N problems (E errors, W
  warnings)` shows E > 30): STOP and show the user the error list grouped by
  rule.
- **30 or fewer errors:** fix each at its source line without changing
  runtime behaviour:
  - `@typescript-eslint/no-explicit-any`: give the value its real type, or
    use `unknown` and narrow it.
  - `@typescript-eslint/no-unused-vars` at error level: delete the unused
    binding.
  - `react-hooks/*` compiler rules (`refs`, `set-state-in-effect`,
    `immutability`, `purity`): move the flagged read/write into an effect or
    event handler. If that would change when something runs, STOP and ask.
  - Warnings stay as they are.

Re-run until it reports `0 errors`.

- [ ] **Step 7: Re-run the build after the lint fixes**

Run: `rtk proxy pnpm build 2>&1 | tail -5`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add package.json pnpm-lock.yaml eslint.config.mjs .eslintrc.json tsconfig.json src/app/orderflow/page.tsx src/hooks/useCvdCharts.tsx
```

Also add, by explicit path, every other file that Step 6 lint fixes touched.
Check `/usr/bin/git status --short` first.

```bash
/usr/bin/git commit -q -m "chore: upgrade toolchain to Next 16 / ESLint flat config" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Browser smoke check + v4 baseline

**Files (scratchpad only, never committed):**
- Create: `$SP/browser-check/package.json`
- Create: `$SP/browser-check/check.mjs`

**Interfaces:**
- Consumes: the Task 2 production build (`pnpm build`), served by
  `pnpm start -p 3100`.
- Produces:
  - **Command:** `node $SP/browser-check/check.mjs <label>`. It exits 0 on
    pass and 1 on fail.
  - **Summary:** prints a JSON summary and writes
    `$SP/browser-check/out/<label>/summary.json`.
  - **Screenshots:** writes `$SP/browser-check/out/<label>/{home,orderflow,cvd}.png`.
  - **Baseline:** `out/v4/summary.json` is the reference for Tasks 4 and 5.

- [ ] **Step 1: Create the harness package**

`$SP/browser-check/package.json`:

```json
{ "name": "browser-check", "private": true, "type": "module" }
```

```bash
cd $SP/browser-check && npm i -q playwright@latest && npx playwright install chromium
```

- [ ] **Step 2: Write `check.mjs`**

`$SP/browser-check/check.mjs`:

```js
// Throwaway smoke check for the chart pages. Usage: node check.mjs <label>
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const MIN_COLORS = Number(process.env.MIN_COLORS ?? 20);
const label = process.argv[2] ?? "run";
const outDir = new URL(`./out/${label}/`, import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

// MEXC is blocked on this network: mock the app's own REST routes in the browser,
// and ignore only the MEXC websocket noise. "Failed to create WebSocket worker" is NOT ignored.
const IGNORED = /contract\.mexc\.com|^WebSocket error:|^Error creating WebSocket:/;
const SYMBOLS = ["BTC_USDT", "ETH_USDT", ...Array.from({ length: 28 }, (_, i) => `SYM${i}_USDT`)];
const BASE_PRICE = { BTC_USDT: 60000, ETH_USDT: 3000 };

function mockCandles(symbol) {
  const step = 300;
  const end = Math.floor(Date.now() / 1000 / step) * step;
  let close = BASE_PRICE[symbol] ?? 10;
  return Array.from({ length: 200 }, (_, i) => {
    const open = close;
    close = open * (1 + Math.sin(i / 7) * 0.004);
    return {
      time: end - (200 - i) * step,
      open,
      high: Math.max(open, close) * 1.002,
      low: Math.min(open, close) * 0.998,
      close,
    };
  });
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE_URL)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server not up at ${BASE_URL}`);
}

function chartStats(page, selector) {
  return page.evaluate((sel) => {
    const container = document.querySelector(sel);
    if (!container) return { found: false, roots: 0, maxColors: 0 };
    let maxColors = 0;
    for (const canvas of container.querySelectorAll("canvas")) {
      if (!canvas.width || !canvas.height) continue;
      const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
      const colors = new Set();
      for (let i = 0; i < data.length; i += 16) {
        colors.add(((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0);
      }
      maxColors = Math.max(maxColors, colors.size);
    }
    return { found: true, roots: container.querySelectorAll(".tv-lightweight-charts").length, maxColors };
  }, selector);
}

async function openPage(browser, path, errors) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on("pageerror", (e) => errors.push(`${path} pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED.test(m.text())) errors.push(`${path} console: ${m.text()}`);
  });
  page.on("requestfailed", (r) => {
    const reason = r.failure()?.errorText ?? "";
    if (r.url().startsWith(BASE_URL) && reason !== "net::ERR_ABORTED") {
      errors.push(`${path} requestfailed: ${r.url()} ${reason}`);
    }
  });
  page.on("response", (r) => {
    if (r.url().startsWith(BASE_URL) && r.status() >= 400) errors.push(`${path} HTTP ${r.status()}: ${r.url()}`);
  });
  await page.route("**/api/mexc/symbols", (r) => r.fulfill({ json: SYMBOLS.map((symbol) => ({ symbol })) }));
  await page.route("**/api/mexc/candles?**", (r) =>
    r.fulfill({ json: mockCandles(new URL(r.request().url()).searchParams.get("symbol")) })
  );
  await page.goto(BASE_URL + path, { waitUntil: "load" });
  return page;
}

await waitForServer();
const browser = await chromium.launch();
const errors = [];
const summary = { label, pages: {} };

// "/" — candles chart + symbol select
{
  const page = await openPage(browser, "/", errors);
  await page.waitForSelector("#chart canvas", { timeout: 20000 });
  await page.waitForTimeout(1500);
  const before = await chartStats(page, "#chart");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "ETH_USDT" }).click();
  await page.waitForFunction(() => /^\d+\.\d{2} \| ETH_USDT$/.test(document.title), null, { timeout: 15000 });
  await page.waitForTimeout(1000);
  const after = await chartStats(page, "#chart");
  summary.pages["/"] = { before, after, title: await page.title() };
  await page.screenshot({ path: outDir + "home.png" });
  await page.close();
}

// "/orderflow" — local sample data, custom rounded-candles series with a whitespace bar
{
  const page = await openPage(browser, "/orderflow", errors);
  await page.waitForSelector("#chart canvas", { timeout: 20000 });
  await page.waitForTimeout(1500);
  summary.pages["/orderflow"] = { chart: await chartStats(page, "#chart") };
  await page.screenshot({ path: outDir + "orderflow.png", fullPage: true });
  await page.close();
}

// "/cvd" — three charts fed by the live Binance trade stream
{
  const page = await openPage(browser, "/cvd", errors);
  const connected = await page
    .getByText("Connected", { exact: true })
    .waitFor({ timeout: 20000 })
    .then(() => true, () => false);
  await page.waitForTimeout(10000);
  summary.pages["/cvd"] = {
    connected,
    line: await chartStats(page, "#line-chart"),
    cvdLine: await chartStats(page, "#cvd-line-chart"),
    cvdCandle: await chartStats(page, "#cvd-candle-chart"),
  };
  await page.screenshot({ path: outDir + "cvd.png", fullPage: true });
  await page.close();
}

await browser.close();

const p = summary.pages;
const allCharts = [p["/"].before, p["/"].after, p["/orderflow"].chart, p["/cvd"].line, p["/cvd"].cvdLine, p["/cvd"].cvdCandle];
const failures = [
  ...errors,
  ...allCharts.filter((c) => c.roots !== 1).map((c) => `chart root count ${c.roots} (want 1)`),
  ...[p["/"].before, p["/"].after, p["/orderflow"].chart]
    .filter((c) => c.maxColors < MIN_COLORS)
    .map((c) => `chart looks blank: ${c.maxColors} colors (want >= ${MIN_COLORS})`),
  ...(p["/cvd"].connected ? [] : ["/cvd never showed Connected (Binance stream unreachable?)"]),
];
summary.failures = failures;
writeFileSync(outDir + "summary.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(failures.length ? 1 : 0);
```

- [ ] **Step 3: Start the production server**

Run `pnpm build` (foreground). Then run `pnpm start -p 3100` with the Bash
tool's `run_in_background: true`. `check.mjs` waits for the server itself.

- [ ] **Step 4: Run the v4 baseline**

Run: `node $SP/browser-check/check.mjs v4`

Expected: exit 0, `failures: []`, every `roots` 1, and `/`,
`/orderflow` `maxColors` ≥ 20.

- If a blank-chart failure fires but the screenshots (open them with the Read
  tool) clearly show drawn candles, the threshold is wrong rather than the
  app. Set `MIN_COLORS` to half the lowest drawn-chart `maxColors` in this
  run (`MIN_COLORS=<n> node check.mjs v4`) and use that value in every later
  run.
- If `/cvd` is not `connected`, Binance is unreachable. Record that, and
  treat the `/cvd` connection line as informational in later runs.
- Any other failure is pre-existing app behaviour. Report it to the user
  before continuing.

- [ ] **Step 5: Stop the server**

Stop the background `pnpm start` task (TaskStop). Nothing to commit: the
harness lives in the scratchpad.

---

### Task 4: lightweight-charts 5 (Stage 3)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Delete: `src/plugins/{brushable-area-series,hlc-area-series,image-watermark,rounded-candles-series,stacked-area-series,stacked-bars-series,vertical-line}/`
- Replace (verbatim from `v5.2.1`): `src/plugins/{anchored-text,background-shade-series,bands-indicator,box-whisker-series,grouped-bars-series,heatmap-series,highlight-bar-crosshair,lollipop-series,overlay-price-scale,partial-price-line,session-highlighting,trend-line,user-price-lines,volume-profile}/`, `src/plugins/plugin-base.ts`, `src/helpers/**`
- Delete: `src/helpers/dimensions/columns.ts`, which no v5.2.1 plugin in the set imports
- Modify: `eslint.config.mjs` (the `vendored` list)
- Modify: `src/hooks/useCvdCharts.tsx` (imports, plus lines 88, 91, 106, 120, 210, 220, 223)
- Modify: `src/context/ChartContext.tsx` (imports, plus line 63)
- Modify: `src/plugins/position-plugin/position-plugin.ts:4,15`
- Modify: `src/plugins/position-plugin/pane-renderer.ts:1,24`
- Modify: whatever else `tsc` flags under `src/app/orderflow/`,
  `src/plugins/position-plugin/`, `src/plugins/utils/` and
  `src/plugins/price-line.ts`

**Interfaces:**
- Consumes:
  - `check.mjs` and `out/v4/summary.json` from Task 3.
  - the `vendored` array in `eslint.config.mjs` from Task 2.
- Produces: the app on lightweight-charts 5.2.1. Charts are created only via
  `chart.addSeries(<Definition>, opts)` or `chart.addCustomSeries(...)`.

- [ ] **Step 1: Install the v5 packages**

```bash
pnpm add lightweight-charts@5.2.1 @tradingview/lwc-plugin-brushable-area-series@latest @tradingview/lwc-plugin-hlc-area-series@latest @tradingview/lwc-plugin-image-watermark@latest @tradingview/lwc-plugin-rounded-candles-series@latest @tradingview/lwc-plugin-stacked-area-series@latest @tradingview/lwc-plugin-stacked-bars-series@latest @tradingview/lwc-plugin-vertical-line@latest
```

- [ ] **Step 2: Swap the plugin sources**

Make sure the `v5.2.1` checkout exists:

```bash
ls $SP/lwc5/plugin-examples/src/plugins
```

If it is missing:

```bash
cd $SP && /usr/bin/git clone -q --depth 1 --branch v5.2.1 --filter=blob:none --sparse https://github.com/tradingview/lightweight-charts.git lwc5 && cd lwc5 && /usr/bin/git sparse-checkout set plugin-examples
```

Write `$SP/swap-plugins-v5.sh`:

```bash
#!/usr/bin/env bash
# Replace PR #4's v4.2.3 plugin copies: 7 official plugins removed (now npm packages),
# 14 re-copied verbatim from upstream v5.2.1, helpers/plugin-base refreshed from the same tag.
set -euo pipefail
S=/tmp/claude-1000/-home-vecordis-GitHub-lightweight-plugins/573410cb-d7c7-45f9-9fc4-259bc88054ea/scratchpad/lwc5/plugin-examples/src
D=/home/vecordis/GitHub/lightweight-plugins/.claude/worktrees/add-lwc-example-plugins/src
OFFICIAL="brushable-area-series hlc-area-series image-watermark rounded-candles-series stacked-area-series stacked-bars-series vertical-line"
COPIED="anchored-text background-shade-series bands-indicator box-whisker-series grouped-bars-series heatmap-series highlight-bar-crosshair lollipop-series overlay-price-scale partial-price-line session-highlighting trend-line user-price-lines volume-profile"

for p in $OFFICIAL; do rm -r "$D/plugins/$p"; done
for p in $COPIED; do
  rm -r "$D/plugins/$p"
  mkdir -p "$D/plugins/$p"
  rsync -a --exclude example "$S/plugins/$p/" "$D/plugins/$p/"
done
cp "$S/plugins/plugin-base.ts" "$D/plugins/plugin-base.ts"
rm -r "$D/helpers"
mkdir -p "$D/helpers/dimensions"
cp "$S"/helpers/{assertions,closest-index,min-max-in-range,simple-clone}.ts "$D/helpers/"
cp "$S"/helpers/dimensions/{candles,common,crosshair-width,full-width,positions}.ts "$D/helpers/dimensions/"
echo "swapped: removed $(echo $OFFICIAL | wc -w), copied $(echo $COPIED | wc -w)"
```

Run: `bash $SP/swap-plugins-v5.sh`
Expected: `swapped: removed 7, copied 14`

- [ ] **Step 3: Verify the copies are verbatim**

Run:

```bash
diff -rq -x example $SP/lwc5/plugin-examples/src/plugins src/plugins
diff -rq $SP/lwc5/plugin-examples/src/helpers src/helpers
```

Expected: only `Only in …` lines. Upstream-only entries are the 7 official
plugins, the 5 excluded interactive plugins and the other upstream-only
dirs (`accessibility`, `dual-range-histogram-series`, `pretty-histogram`).
Ours-only entries are `position-plugin`, `price-line.ts` and `utils`.
Helpers differ only by upstream `delegate.ts`, `time.ts` and
`dimensions/columns.ts`. There must be no `Files … differ` lines.

- [ ] **Step 4: Drop the 7 official plugins from the ESLint ignore list**

In `eslint.config.mjs`, delete these seven entries from `vendored`:
- `"src/plugins/brushable-area-series/**"`
- `"src/plugins/hlc-area-series/**"`
- `"src/plugins/image-watermark/**"`
- `"src/plugins/rounded-candles-series/**"`
- `"src/plugins/stacked-area-series/**"`
- `"src/plugins/stacked-bars-series/**"`
- `"src/plugins/vertical-line/**"`

- [ ] **Step 5: Migrate the series creation calls**

In `src/hooks/useCvdCharts.tsx`, add the series definitions to the
`lightweight-charts` import:

```ts
import {
  BaselineData,
  BaselineSeries,
  CandlestickData,
  CandlestickSeries,
  type CandlestickSeriesPartialOptions,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  LineSeries,
  createChart as lightWeightCreateChart,
} from "lightweight-charts";
```

Then replace these calls:

| Line | Before | After |
|---|---|---|
| 88 | `tradeChartRef.current.addLineSeries({ ...options, color: "#ef4444" })` | `tradeChartRef.current.addSeries(LineSeries, { ...options, color: "#ef4444" })` |
| 91 | `tradeChartRef.current.addLineSeries({ ...options, color: "#22c55e" })` | `tradeChartRef.current.addSeries(LineSeries, { ...options, color: "#22c55e" })` |
| 106 | `cvdChartRef.current.addBaselineSeries({ ...options, baseLineColor: "#ffffff" })` | `cvdChartRef.current.addSeries(BaselineSeries, { ...options, baseLineColor: "#ffffff" })` |
| 120 | `cvdCandleChartRef.current.addCandlestickSeries(options)` | `cvdCandleChartRef.current.addSeries(CandlestickSeries, options)` |
| 210 | `chart.current.addCandlestickSeries(options)` | `chart.current.addSeries(CandlestickSeries, options)` |
| 220 | `chart.current.addLineSeries({ ...options, color: "#ef4444" })` | `chart.current.addSeries(LineSeries, { ...options, color: "#ef4444" })` |
| 223 | `chart.current.addLineSeries({ ...options, color: "#22c55e" })` | `chart.current.addSeries(LineSeries, { ...options, color: "#22c55e" })` |

(Line numbers are pre-Task-2. Find each call by its text.)

In `src/context/ChartContext.tsx`, add `CandlestickSeries,` to the
`lightweight-charts` import. Then change line 63:

```ts
    const candlestickSeries = chartInstance.current.addCandlestickSeries(options);
```

to:

```ts
    const candlestickSeries = chartInstance.current.addSeries(CandlestickSeries, options);
```

- [ ] **Step 6: Rename the v5 primitive types**

`src/plugins/position-plugin/position-plugin.ts`: in the import (line 4) and
in `class RectanglePaneView implements ISeriesPrimitivePaneView` (line 15),
rename `ISeriesPrimitivePaneView` → `IPrimitivePaneView`.

`src/plugins/position-plugin/pane-renderer.ts`: in the import (line 1) and in
`implements ISeriesPrimitivePaneRenderer` (line 24), rename
`ISeriesPrimitivePaneRenderer` → `IPrimitivePaneRenderer`.

- [ ] **Step 7: Type-check and fix the remaining v5 errors**

Run: `rtk proxy npx tsc --noEmit -p . 2>&1 | /usr/bin/grep 'error TS'`

Expected: 0 errors.

- Fix any remaining error in app code (`src/app/orderflow/*`,
  `src/plugins/position-plugin/*`, `src/plugins/utils/*`,
  `src/plugins/price-line.ts`) using the official v4 → v5 migration guide:
  https://tradingview.github.io/lightweight-charts/docs/migrations/from-v4-to-v5
- `src/app/orderflow/rounded-candles-series.ts`, `renderer.ts` and `data.ts`
  are the app's customised copy. Fix them in place; do **not** replace them
  with `@tradingview/lwc-plugin-rounded-candles-series`.
- An error inside a verbatim-copied dir (the 14 plugins, `plugin-base.ts` or
  `src/helpers/`) must not be hand-edited. STOP and report it, because it
  means upstream `v5.2.1` doesn't compile against the installed 5.2.1.

- [ ] **Step 8: Build and lint gate**

Run: `rtk proxy pnpm build 2>&1 | tail -5`, then
`rtk proxy pnpm lint 2>&1 | tail -10`.

Expected: build succeeds, and lint shows `0 errors`.

- [ ] **Step 9: Browser gate**

1. Run `pnpm start -p 3100` in the background.
2. Run `node $SP/browser-check/check.mjs v5`, using the same `MIN_COLORS` as
   the baseline if Task 3 changed it.
3. Stop the server.

Expected: exit 0. Each `maxColors` is in the same range as
`out/v4/summary.json`, meaning not below half of it.

Compare `out/v5/*.png` with `out/v4/*.png` using the Read tool. Candles and
lines must look the same apart from v5 cosmetic defaults (for example, the
TradingView attribution logo).

- [ ] **Step 10: Commit**

```bash
/usr/bin/git add package.json pnpm-lock.yaml eslint.config.mjs src/plugins src/helpers src/hooks/useCvdCharts.tsx src/context/ChartContext.tsx
```

Also add, by explicit path, any `src/app/orderflow/*` files that Step 7
touched. Check `/usr/bin/git status --short`; deletions under `src/plugins`
are staged by `src/plugins`.

```bash
/usr/bin/git commit -q -m "feat: migrate to lightweight-charts 5" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: UI library majors (Stage 4)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `src/components/ui/custom-select.tsx` (lines 5 and 68–90)
- Regenerate: `src/components/ui/calendar.tsx`,
  `src/components/ui/resizable.tsx`, `src/components/ui/chart.tsx` (all
  stock; only commit `6e726a5` touched them)
- Modify: any `src/components/ui/*.tsx` whose lucide icon import `tsc` flags

**Interfaces:**
- Consumes: `check.mjs` from Task 3.
- Produces: `CustomSelect` with an unchanged public props API
  (`SelectOption<T>` and `CustomSelectProps<T>`), rendering its virtualized
  branch with react-window v2 `List`.

- [ ] **Step 1: Upgrade the UI majors**

```bash
pnpm add react-window@latest react-day-picker@latest react-resizable-panels@latest recharts@latest lucide-react@latest zod@latest
pnpm remove @types/react-window
```

- [ ] **Step 2: Port `CustomSelect` to react-window v2**

In `src/components/ui/custom-select.tsx`, replace line 5

```tsx
import { FixedSizeList as List } from "react-window";
```

with:

```tsx
import { List, type RowComponentProps } from "react-window";
```

Below the `CustomSelectProps` interface (after line 26), add:

```tsx
interface OptionRowProps {
  options: SelectOption<string>[];
  width: number | string;
}

function OptionRow({ index, style, options, width }: RowComponentProps<OptionRowProps>) {
  const option = options[index];
  return (
    <SelectItem value={option.value} style={{ ...style, width }}>
      {option.label}
    </SelectItem>
  );
}
```

Replace the virtualized branch (old lines 69–90, the
`<div style={{ height: … }}> <List …>{…}</List> </div>` block) with:

```tsx
            <div style={{ height: Math.min(maxHeight, options.length * itemHeight) }}>
              <List
                rowComponent={OptionRow}
                rowCount={options.length}
                rowHeight={itemHeight}
                rowProps={{ options, width: contentWidth || "100%" }}
                style={{ height: Math.min(maxHeight, options.length * itemHeight), width: "100%" }}
                className="no-scrollbar"
              />
            </div>
```

- [ ] **Step 3: Regenerate the stock shadcn components**

```bash
pnpm dlx shadcn@latest add calendar resizable chart --overwrite --yes
/usr/bin/git status --short
```

Keep the changes to `src/components/ui/calendar.tsx`, `resizable.tsx`,
`chart.tsx`, `package.json` and `pnpm-lock.yaml`. For every other modified
file the CLI touched (for example `button.tsx` or `globals.css`), run
`/usr/bin/git checkout -- <path>`. Delete any new file the CLI created that
isn't one of the three. Then run `/usr/bin/git diff package.json`. If the
CLI downgraded any of the Step 1 versions, re-run Step 1's `pnpm add` line.

- [ ] **Step 4: Type-check gate**

Run: `rtk proxy npx tsc --noEmit -p . 2>&1 | /usr/bin/grep 'error TS'`

Expected: 0 errors.

- **Error in a regenerated shadcn file** (the registry template lags the
  new major): hand-fix only that compile error, using the library's own
  `.d.ts` in `node_modules/<lib>` as the reference.
- **Lucide error** (`has no exported member 'XIcon'`): rename the import to
  the lucide 1.x name. Look it up with
  `/usr/bin/grep -o '"[A-Za-z]*Icon"' node_modules/lucide-react/dist/lucide-react.d.ts | head`,
  or check that the non-`Icon` alias exists.

- [ ] **Step 5: Build, lint and browser gate**

Run `rtk proxy pnpm build 2>&1 | tail -5`, then
`rtk proxy pnpm lint 2>&1 | tail -10`. Then start the server in the
background, run `node $SP/browser-check/check.mjs ui`, and stop the server.

Expected: build ok, `0 errors`, and the check exits 0. The `/` select step
(open → pick ETH_USDT → title updates) passes on Radix + React 19.3. The
virtualized `List` branch is covered by `tsc` only (see Review Focus 5).

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add package.json pnpm-lock.yaml src/components/ui/custom-select.tsx src/components/ui/calendar.tsx src/components/ui/resizable.tsx src/components/ui/chart.tsx
```

Also add, by explicit path, any other `src/components/ui/*.tsx` that Step 4
touched.

```bash
/usr/bin/git commit -q -m "chore: upgrade UI library majors" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Push, update PR #4, review

**Files:**
- Create: `$SP/pr4-body.md` (scratchpad)

**Interfaces:**
- Consumes:
  - the four stage commits.
  - `out/{v4,v5,ui}/summary.json`.
  - any cap notes recorded in Task 2 Step 6.
- Produces: the updated PR #4 and a code review with every HIGH finding
  fixed.

- [ ] **Step 1: Final full verification**

Run:

```bash
rtk proxy pnpm build 2>&1 | tail -5
rtk proxy pnpm lint 2>&1 | tail -5
rtk proxy pnpm outdated 2>&1 | /usr/bin/grep '│' | /usr/bin/grep -v Package
```

Expected:
- Build OK and `0 errors`.
- `outdated` lists only `typescript` (6.0.3 → 7.x), plus `eslint` only if
  Task 2 fell back to 9.x.

- [ ] **Step 2: Push**

Run: `/usr/bin/git push`

- [ ] **Step 3: Rewrite the PR title and body**

Write `$SP/pr4-body.md` with these sections:

- **Summary:** the 21 plugins and the deps upgrade.
- **Plugins:** 7 from npm, 14 verbatim from `v5.2.1`, and the 5 interactive
  ones excluded.
- **Stages:** one bullet per commit, saying what changed.
- **Version caps:**
  - TypeScript 6.0.3: typescript-eslint peers `<6.1.0`, and TS 7 dropped
    the JS API. Unblocked when typescript-eslint supports TS 7.
  - ESLint 9.x, only if the fallback was used: name the plugin that crashed.
- **Verification:**
  - the real `pnpm build` / `pnpm lint` tail output.
  - the `check.mjs` summary for `ui`.
  - a note that MEXC is blocked on the dev network, so `/` used mocked
    `/api/mexc/*` responses.
- **Not verified at runtime:** the virtualized `CustomSelect` branch,
  because the app always passes `virtualized={false}`.
- **Test plan:** checkboxes, ending with the line
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

```bash
gh pr edit 4 --title "feat: lightweight-charts 5 plugins + upgrade all deps to latest" --body-file $SP/pr4-body.md
```

If that fails with a GraphQL error:

```bash
gh api -X PATCH repos/Effanuel/lightweight-plugins/pulls/4 -f title="feat: lightweight-charts 5 plugins + upgrade all deps to latest" -F body=@$SP/pr4-body.md
```

- [ ] **Step 4: Code review**

Dispatch the `code-reviewer` agent on `master...HEAD`. Tell it:
- the verbatim-copied dirs are out of scope.
- it should focus on the stage diffs: `package.json`, `eslint.config.mjs`,
  `useCvdCharts.tsx`, `ChartContext.tsx`, `orderflow/page.tsx`,
  `position-plugin/*`, `custom-select.tsx` and the regenerated shadcn files.

Fix every HIGH or CRITICAL finding. Re-run `pnpm build`, `pnpm lint` and
`check.mjs final`, commit the fixes as
`fix: address review findings` (explicit paths), and push.

- [ ] **Step 5: Report**

Tell the user:
- the PR link.
- the per-stage results, with the real gate output.
- the caps.
- the browser screenshots path `$SP/browser-check/out/`.
- anything unverified.
