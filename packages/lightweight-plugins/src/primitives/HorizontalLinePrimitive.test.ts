import { describe, it, expect, vi } from "vitest";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { HorizontalLinePrimitive } from "./HorizontalLinePrimitive";
import { DEFAULT_DRAWING_STYLE } from "../lib/drawing-style";

function makeSeries(coordByPrice: Map<number, number | null>) {
  return { priceToCoordinate: vi.fn((p: number) => coordByPrice.get(p) ?? null) } as unknown as ISeriesApi<"Candlestick", Time>;
}
function makeChart(coordByTime: Map<number, number | null>) {
  return {
    timeScale: () => ({ timeToCoordinate: vi.fn((t: number) => coordByTime.get(t) ?? null), width: () => 800 }),
  } as unknown as IChartApi;
}
const container = { clientWidth: 800 } as unknown as HTMLDivElement;

// line: price 100 -> y200, time 1000 -> x100 (anchor dot).
function setup() {
  const p = new HorizontalLinePrimitive();
  p.chart = makeChart(new Map([[1000, 100]]));
  p.series = makeSeries(new Map([[100, 200]]));
  p.setData([{ id: 1, price: 100, time: 1000, style: { ...DEFAULT_DRAWING_STYLE } }], container, 0.01);
  return p;
}

describe("HorizontalLinePrimitive", () => {
  it("lineHitTest hits anywhere along the row regardless of x", () => {
    expect(setup().lineHitTest(700, 202)).toBe(1);
  });
  it("lineHitTest misses when y is off the row", () => {
    expect(setup().lineHitTest(700, 240)).toBeNull();
  });
  it("originHitTest hits near the anchor dot", () => {
    expect(setup().originHitTest(102, 201)).toBe(1);
  });
  it("getEnclosedIds includes the line when its anchor is in the rect", () => {
    expect(setup().getEnclosedIds({ minX: 80, minY: 180, maxX: 150, maxY: 220 })).toEqual([1]);
  });
  it("getEnclosedIds excludes the line when its anchor is outside the rect", () => {
    expect(setup().getEnclosedIds({ minX: 300, minY: 300, maxX: 400, maxY: 400 })).toEqual([]);
  });
  it("hitTest near origin dot returns move cursor with origin externalId", () => {
    expect(setup().hitTest(101, 201)).toEqual({ cursorStyle: "move", externalId: "hline-origin:1", zOrder: "normal" });
  });
  it("hitTest on line away from origin returns pointer cursor with line externalId", () => {
    expect(setup().hitTest(700, 201)).toEqual({ cursorStyle: "pointer", externalId: "hline:1", zOrder: "normal" });
  });
  it("hitTest on clear miss returns null", () => {
    expect(setup().hitTest(700, 300)).toBeNull();
  });
});
