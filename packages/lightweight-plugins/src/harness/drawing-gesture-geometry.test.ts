import { describe, expect, test, vi } from "vitest";
import type { IChartApi } from "lightweight-charts";
import { createDrawingGeometry } from "./drawing-gesture-geometry";
import { registerChartEnv, type Bar } from "../lib/chart-measure";
import type { ChartPluginContext } from "./chart-plugin";

function ctx(env: { bars?: Bar[]; magnet?: () => boolean } = {}): ChartPluginContext {
  const chart = {
    applyOptions: vi.fn(),
    timeScale: () => ({ width: () => 800, coordinateToLogical: (x: number) => x }),
  } as unknown as IChartApi;
  registerChartEnv(chart, {
    getBars: () => env.bars ?? [{ time: 0 }, { time: 10 }],
    tickSize: () => 0.25,
    magnet: env.magnet,
  });
  const container = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 400 }),
  } as unknown as HTMLDivElement;
  return { chart, series: { priceToCoordinate: (p) => p, coordinateToPrice: (c) => c + 0.1 }, container };
}

describe("createDrawingGeometry", () => {
  test("sampleAt snaps both prices to the tick and has no magnet", () => {
    const g = createDrawingGeometry(ctx(), () => 0.25, vi.fn());
    expect(g.sampleAt(30, 50)).toEqual({ x: 30, y: 50, time: 300, rawPrice: 50, magnetPrice: 50 });
  });

  test("magnetPrice snaps to the hovered bar's nearest OHLC within 8px while the magnet is on; rawPrice never does", () => {
    let on = true;
    const bars = [
      { time: 0, open: 40, high: 60, low: 30, close: 55 },
      { time: 10, value: 80 },
    ];
    const g = createDrawingGeometry(ctx({ bars, magnet: () => on }), () => 0.25, vi.fn());
    expect(g.sampleAt(0, 57)).toMatchObject({ rawPrice: 57, magnetPrice: 55 }); // raw 57.1: close is 2px off, high 3px
    expect(g.sampleAt(0, 70)).toMatchObject({ magnetPrice: 70 }); // high is 10px off
    expect(g.sampleAt(1, 75)).toMatchObject({ magnetPrice: 80 }); // a line bar's value
    on = false;
    expect(g.sampleAt(0, 57)).toMatchObject({ magnetPrice: 57 });
  });

  test("paneCoords rejects the price axis and points outside the pane", () => {
    const g = createDrawingGeometry(ctx(), () => 0.25, vi.fn());
    const at = (x: number, y: number) => ({ clientX: x, clientY: y }) as MouseEvent;
    expect(g.paneCoords(at(10, 10))).toEqual({ x: 10, y: 10 });
    expect(g.paneCoords(at(850, 10))).toBeNull();
    expect(g.paneCoords(at(10, 450))).toBeNull();
  });

  test("lockScroll goes through the env's lock (the manager owns the chart options)", () => {
    const lockScroll = vi.fn();
    createDrawingGeometry(ctx(), () => 1, lockScroll).lockScroll(true);
    expect(lockScroll).toHaveBeenCalledWith(true);
  });
});
