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
