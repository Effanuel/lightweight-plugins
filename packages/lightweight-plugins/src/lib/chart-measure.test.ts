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
