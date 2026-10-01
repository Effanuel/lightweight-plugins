import { describe, it, expect, vi } from "vitest";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { TrendLinePrimitive } from "./TrendLinePrimitive";
import { DEFAULT_DRAWING_STYLE } from "../lib/drawing-style";

function makeSeries(coordByPrice: Map<number, number | null>) {
  return { priceToCoordinate: vi.fn((p: number) => coordByPrice.get(p) ?? null) } as unknown as ISeriesApi<"Candlestick", Time>;
}
function makeChart(coordByTime: Map<number, number | null>) {
  return {
    timeScale: () => ({ timeToCoordinate: vi.fn((t: number) => coordByTime.get(t) ?? null), width: () => 800 }),
  } as unknown as IChartApi;
}

// p1: time 1000 -> x100, price 100 -> y100. p2: time 2000 -> x300, price 120 -> y300.
function setup() {
  const p = new TrendLinePrimitive();
  p.chart = makeChart(new Map([[1000, 100], [2000, 300]]));
  p.series = makeSeries(new Map([[100, 100], [120, 300]]));
  p.setData([{ id: 1, p1: { price: 100, time: 1000 }, p2: { price: 120, time: 2000 }, style: { ...DEFAULT_DRAWING_STYLE } }]);
  return p;
}

describe("TrendLinePrimitive", () => {
  it("endpointHitTest hits p1", () => {
    expect(setup().endpointHitTest(102, 103)).toEqual({ trendId: 1, endpoint: "p1" });
  });
  it("endpointHitTest hits p2", () => {
    expect(setup().endpointHitTest(298, 301)).toEqual({ trendId: 1, endpoint: "p2" });
  });
  it("endpointHitTest misses between endpoints", () => {
    expect(setup().endpointHitTest(200, 200)).toBeNull();
  });
  it("lineHitTest hits a point on the segment", () => {
    expect(setup().lineHitTest(200, 200)).toBe(1);
  });
  it("lineHitTest misses a point off the segment", () => {
    expect(setup().lineHitTest(200, 260)).toBeNull();
  });
  it("getEnclosedIds includes a trend with one endpoint in the rect", () => {
    expect(setup().getEnclosedIds({ minX: 80, minY: 80, maxX: 150, maxY: 150 })).toEqual([1]);
  });
  it("getEnclosedIds excludes a trend with no endpoint in the rect", () => {
    expect(setup().getEnclosedIds({ minX: 400, minY: 400, maxX: 500, maxY: 500 })).toEqual([]);
  });
  it("lineHitTest misses just outside the tolerance band", () => {
    // Segment (100,100)→(300,300). Point (195,205) is perpendicular-offset ~7.07px from midpoint (200,200),
    // which exceeds LINE_HIT_TOLERANCE=6. Computed: sqrt((195-200)²+(205-200)²) = sqrt(50) ≈ 7.07.
    expect(setup().lineHitTest(195, 205)).toBeNull();
  });
});
