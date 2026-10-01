# Upgrade all dependencies to latest — design

Date: 2026-10-01 · Branch: `worktree-add-lwc-example-plugins` (PR #4)

## Goal

Every dependency in `package.json` on its latest version, including major
versions, with the app still working.

**Done when**
1. `pnpm build` passes.
2. `pnpm lint` passes (errors = 0; warnings allowed).
3. A headless browser shows charts drawn on `/`, `/cvd` and `/orderflow`, and
   the `/` symbol select works, with no console errors other than network
   failures to MEXC if the sandbox blocks them.

## Decisions

From the user:
- Majors included, among them lightweight-charts 5.
- The work extends PR #4 (no new PR).
- The plugin added in PR #4 that has an official npm package comes from npm.
  The rest are copied from upstream.
- The approach is staged, "latest unless blocked". A package goes to its true
  latest unless a peer range or real breakage blocks that. In that case it
  goes to the newest compatible version, and the cap is recorded in the PR.

Made during design (each approved):
- **TypeScript capped at the newest 6.0.x.** TS 7.0.2 no longer ships the
  classic compiler API (its main export is `lib/version.cjs`), and
  `typescript-eslint` (required by `eslint-config-next` 16) peers
  `typescript >=4.8.4 <6.1.0`. Unblocked when typescript-eslint supports TS 7.
- **ESLint: try 10.x first, fall back to newest 9.x.** `eslint-plugin-react`,
  `eslint-plugin-import` and `eslint-plugin-jsx-a11y` (all pulled in by
  `eslint-config-next` 16) declare peer support only up to ESLint 9. The
  fallback applies only if linting actually fails on 10. If used, it is
  unblocked when those plugins support ESLint 10.
- **The 14 copied plugins come from upstream tag `v5.2.1`, not master.** That
  tag matches the released library version and keeps PR #4's self-contained
  layout, with local `src/helpers/` and `plugin-base.ts` and no
  `@tradingview/lwc-toolkit` dependency.
- Unused dependencies (`zod`, `@hookform/resolvers`, `date-fns`,
  `worker-loader`) are upgraded, not removed.

## Stage 1 — minor/patch bumps

Raise every non-major dependency's `package.json` specifier to its current
latest. That includes the radix-ui packages, `react`/`react-dom` 19.3,
`@types/react`/`@types/react-dom` 19.3, `tailwindcss`/`@tailwindcss/postcss`
4.3, `tw-animate-css`, `postcss`, `swr`, `react-hook-form`, `sonner`,
`date-fns`, `input-otp`, `tailwind-merge` and `@hookform/resolvers`. The
lockfile is regenerated.

No code changes expected.
**Gate:** `tsc --noEmit` reports no errors beyond the 2 already on master in
`src/app/orderflow/page.tsx`.
**Commit:** `chore: bump minor/patch deps`

## Stage 2 — toolchain

- Upgrade `next` and `eslint-config-next` to 16.3.8 (latest).
- Upgrade `eslint` to 10.x, falling back to 9.x as described above.
- Upgrade `typescript` to the newest 6.0.x, and `@types/node` to latest (26.x).
- Delete `.eslintrc.json`. Add a flat `eslint.config.mjs` using
  eslint-config-next's `core-web-vitals` and `typescript` presets, ignoring
  `.next/`, `.claude/`, `node_modules/` and `next-env.d.ts`.
- Change the `package.json` `lint` script from `next lint` to `eslint .`
  (Next 16 removed `next lint`, and `next build` no longer lints).
- Fix the existing type errors in `src/app/orderflow/page.tsx`. `chartDiv`
  becomes `useRef<HTMLDivElement>(null)` and the `IChartApi` is held
  separately.
- Fix every lint **error** the new config reports, leaving warnings alone. If
  there are more than about 30 errors, stop and show the list before
  editing.

These need no change:
- `next.config.mjs`, which has no webpack config, so Turbopack being the
  default build is fine.
- The worker, which uses `new Worker(new URL(...), import.meta.url)` and is
  supported by Turbopack.
- `src/app/api/mexc/candles/route.ts`, which only reads
  `request.nextUrl.searchParams` and is unaffected by the async `params`
  change.

**Gate:** `pnpm build` and `pnpm lint` pass.
**Commit:** `chore: upgrade toolchain to Next 16 / ESLint flat config`

## Stage 3 — lightweight-charts 4.2.0 → 5.2.1

### Plugins (replaces PR #4's v4.2.3 copies)

| Plugin | v5 source |
|---|---|
| brushable-area-series, hlc-area-series, image-watermark, rounded-candles-series, stacked-area-series, stacked-bars-series, vertical-line | npm `@tradingview/lwc-plugin-<name>`@latest. Delete `src/plugins/<name>/`. |
| anchored-text, background-shade-series, bands-indicator, box-whisker-series, grouped-bars-series, heatmap-series, highlight-bar-crosshair, lollipop-series, overlay-price-scale, partial-price-line, session-highlighting, trend-line, user-price-lines, volume-profile | Copy verbatim from upstream `v5.2.1` `plugin-examples/src/plugins/<name>/`, excluding `example/`. |

Refresh `src/plugins/plugin-base.ts` and `src/helpers/**` from the same
tag. Keep only the helpers that the 14 copied plugins import.

### App code

- `src/hooks/useCvdCharts.tsx` and `src/context/ChartContext.tsx`: replace
  `chart.addLineSeries(o)`, `chart.addBaselineSeries(o)` and
  `chart.addCandlestickSeries(o)` with `chart.addSeries(LineSeries, o)`,
  `chart.addSeries(BaselineSeries, o)` and
  `chart.addSeries(CandlestickSeries, o)`.
- `src/plugins/position-plugin/*`, `src/plugins/price-line.ts` and
  `src/plugins/utils/*`: rename the primitive types
  (`ISeriesPrimitivePaneView` → `IPrimitivePaneView`,
  `ISeriesPrimitivePaneRenderer` → `IPrimitivePaneRenderer`) and fix whatever
  else `tsc` reports.
- `src/app/orderflow/*`: keep the customised local rounded-candles copy (do
  not swap it for the npm package). Apply only the v5 fixes `tsc` reports.
  `addCustomSeries` still exists in v5.
- No watermark or `setMarkers` usage exists, so those v5 removals do not
  apply.

**Gate:** `pnpm build`, `pnpm lint`, and the browser check (see Verification)
on `/`, `/cvd` and `/orderflow`.
**Commit:** `feat: migrate to lightweight-charts 5`

## Stage 4 — UI library majors

- **react-window 1 → 2.** Its only consumer is
  `src/components/ui/custom-select.tsx`, used by `/`. Port its
  `FixedSizeList` (`itemCount`, `itemSize`, child renderer) to v2's `List`
  (`rowCount`, `rowHeight`, `rowComponent`, `rowProps`). Remove
  `@types/react-window`, which v2 makes unnecessary because it ships its own
  types.
- **react-day-picker 8 → 10, react-resizable-panels 2 → 4, recharts 2 → 3.**
  Their only consumers are `calendar.tsx`, `resizable.tsx` and `chart.tsx` in
  `src/components/ui/`, all stock shadcn files the app never imports.
  - Diff each against its shadcn registry version first.
  - If a file is unmodified and the registry template compiles against the
    new major, regenerate it with
    `pnpm dlx shadcn@latest add <name> --overwrite`.
  - Otherwise, hand-fix only the compile errors.
- **lucide-react 0.x → 1.x.** Fix any icon renames `tsc` reports. The ui
  files import 17 standard icons.
- **zod 3 → 4.** Version bump only; it is not imported anywhere.

**Gate:** `pnpm build`, `pnpm lint`, and the browser check, including the `/`
select opening, scrolling, and changing the symbol when an option is chosen.
**Commit:** `chore: upgrade UI library majors`

## Verification

- **Type check and lint.** Each stage runs `pnpm build` and `pnpm lint`.
  Results are reported with real output.
- **Browser check.** A one-off Playwright script lives in the session
  scratchpad and is never added to `package.json`. It runs against
  `pnpm start` (the production build).
  - For each page, it checks that every chart `<canvas>` has non-blank pixels.
  - It collects console errors.
  - It saves screenshots for the user.
- **Network.** `/` and `/cvd` need live MEXC REST and websocket access. If the
  sandbox blocks the network, report that. The check then becomes "page
  loads, chart canvas mounts, no console errors except network". `/orderflow`
  uses local sample data and must fully render.

## Scope guard

Stop and ask, instead of widening scope, if any of these happen:
- A cap is needed beyond TypeScript and ESLint.
- There are more than about 30 lint errors.
- There is a runtime chart regression whose cause can't be traced.
- An official plugin package's API differs from the v4 copy in a way the
  app would care about. Today the app doesn't import any of the 21 plugins,
  so no app code depends on them.

## PR #4 update

- **Title:** `feat: lightweight-charts 5 plugins + upgrade all deps to latest`.
- **Body:** rewritten with notes for each stage, the version caps and what
  unblocks them, and the test plan.
- **Body update method:** `gh pr edit`, falling back to
  `gh api -X PATCH repos/Effanuel/lightweight-plugins/pulls/4`.
- **Review:** run a code review after pushing, and fix every HIGH finding
  before reporting done.

## Out of scope

- Removing unused dependencies or unused shadcn components.
- Adding a test suite or Playwright as a project dependency.
- Re-adding the 5 interactive plugins excluded in PR #4.
- Refactoring app code beyond what the upgrades require.
