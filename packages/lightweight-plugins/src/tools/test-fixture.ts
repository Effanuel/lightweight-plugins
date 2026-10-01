import { vi } from "vitest";
import { createDrawingToolPlugin, type DrawingToolConfig } from "../harness/drawing-tool-plugin";
import type { ChartGeometry } from "../harness/chart-gesture";
import type { ChartPluginContext } from "../harness/chart-plugin";
import type { DrawingSample } from "../harness/drawing-gesture-geometry";
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
    lockScroll: vi.fn(),
  };
}

/**
 * Fake Chart Geometry. sampleAt is linear and total, so every click resolves:
 * time = x * 10, rawPrice = y, magnetPrice = y + 0.5.
 */
export function makeGeometry(): ChartGeometry<DrawingSample> {
  return {
    paneCoords: (e: MouseEvent) => ({ x: e.clientX, y: e.clientY }),
    sampleAt: (x, y) => ({ x, y, time: x * 10, rawPrice: y, magnetPrice: y + 0.5 }),
    lockScroll: vi.fn(),
  };
}

type Fired = { type: string; listener: (e: never) => void };

/** Fake container/document/window triple that records listeners and can fire them. */
export function makeDom() {
  const targets = { container: [] as Fired[], document: [] as Fired[], window: [] as Fired[] };
  const record = (bucket: Fired[]) => ({
    addEventListener: (type: string, listener: (e: never) => void) => { bucket.push({ type, listener }); },
    removeEventListener: (type: string, listener: (e: never) => void) => {
      const i = bucket.findIndex((f) => f.type === type && f.listener === listener);
      if (i >= 0) bucket.splice(i, 1);
    },
  });
  const win = record(targets.window);
  const doc = { ...record(targets.document), defaultView: win };
  const container = { ...record(targets.container), ownerDocument: doc };
  // Honors stopImmediatePropagation like the DOM does: a handler that stops the
  // event keeps every later listener on the same target from running.
  const fire = (where: keyof typeof targets, type: string, e: unknown) => {
    let stopped = false;
    const ev = e as { stopImmediatePropagation?: () => void };
    const orig = ev.stopImmediatePropagation;
    ev.stopImmediatePropagation = () => {
      stopped = true;
      orig?.call(ev);
    };
    for (const f of [...targets[where]]) {
      if (stopped) break;
      if (f.type === type) f.listener(e as never);
    }
  };
  return { container, fire };
}

export function mouse(x: number, y: number, opts: { altKey?: boolean } = {}) {
  return {
    clientX: x, clientY: y, button: 0, defaultPrevented: false, altKey: opts.altKey ?? false,
    preventDefault: vi.fn(function (this: { defaultPrevented: boolean }) { this.defaultPrevented = true; }),
    stopImmediatePropagation: vi.fn(),
  } as unknown as MouseEvent;
}

/**
 * Mounts a tool config through the harness with the fake geometry injected.
 * The chart/series stubs cover what the tool configs reach for during a
 * mount: priceToCoordinate (previews),
 * timeScale().width() (fibonacci preview), timeScale().coordinateToLogical()/
 * timeToCoordinate() (drag time resolution via chart-measure's timeAtX /
 * timeToCoordinateOrNearest / projectPoint).
 *
 * Every mounted primitive is also handed `attached({ chart, series, requestUpdate })`,
 * the same public lifecycle call lightweight-charts makes when a primitive attaches to a
 * live series. DrawingPrimitiveBase stores chart/series from it and several primitives'
 * geometric hit-tests (TrendLinePrimitive.endpointHitTest, BoxToolPrimitive.cornerHitTest/
 * edgeHitTest/boxHitTest, ...) bail out with a null this.chart/this.series guard otherwise.
 */
export function mountTool<T extends { id: number; style: TStyle }, TStyle, Hit, DragCtx>(
  config: DrawingToolConfig<T, TStyle, Hit, DragCtx>,
) {
  const { container, fire } = makeDom();
  const chart = {
    applyOptions: vi.fn(),
    timeScale: () => ({
      width: () => 800,
      options: () => ({ barSpacing: 1 }),
      coordinateToLogical: (x: number) => x,
      timeToCoordinate: (t: number) => t / 10,
    }),
  };
  registerChartEnv(chart as never, { getBars: () => [{ time: 0 }, { time: 10 }], tickSize: () => 0.01 });
  const series = { priceToCoordinate: (p: number) => p, coordinateToPrice: (c: number) => c };
  const ctx = {
    container,
    chart,
    series,
  } as unknown as ChartPluginContext;
  const api = createDrawingToolPlugin({ ...config, geometry: () => makeGeometry() });
  const teardown = api.plugin.onMount!(ctx);
  for (const primitive of api.plugin.primitives()) {
    const attach = (primitive as unknown as { attached?: (param: unknown) => void }).attached;
    attach?.call(primitive, { chart, series, requestUpdate: vi.fn() });
  }
  return { api, fire, teardown };
}
