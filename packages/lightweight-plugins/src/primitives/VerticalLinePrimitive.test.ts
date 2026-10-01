import { describe, it, expect, vi } from "vitest";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { VerticalLinePrimitive } from "./VerticalLinePrimitive";
import { DEFAULT_DRAWING_STYLE } from "../lib/drawing-style";

function makeSeries(coordByPrice: Map<number, number | null>) {
  return { priceToCoordinate: vi.fn((p: number) => coordByPrice.get(p) ?? null) } as unknown as ISeriesApi<"Candlestick", Time>;
}
function makeChart(coordByTime: Map<number, number | null>) {
  return {
    timeScale: () => ({ timeToCoordinate: vi.fn((t: number) => coordByTime.get(t) ?? null), width: () => 800 }),
  } as unknown as IChartApi;
}
const container = { clientHeight: 600 } as unknown as HTMLDivElement;

// line: time 1000 -> x100, price 100 -> y200 (anchor dot).
function setup() {
  const p = new VerticalLinePrimitive();
  p.chart = makeChart(new Map([[1000, 100]]));
  p.series = makeSeries(new Map([[100, 200]]));
  p.setData([{ id: 1, time: 1000, price: 100, style: { ...DEFAULT_DRAWING_STYLE } }], container);
  return p;
}

describe("VerticalLinePrimitive", () => {
  it("lineHitTest hits anywhere along the column regardless of y", () => {
    expect(setup().lineHitTest(102, 500)).toBe(1);
  });
  it("lineHitTest misses when x is off the column", () => {
    expect(setup().lineHitTest(140, 500)).toBeNull();
  });
  it("anchorHitTest hits near the anchor dot", () => {
    expect(setup().anchorHitTest(101, 202)).toBe(1);
  });
  it("getEnclosedIds includes the line when its anchor is in the rect", () => {
    expect(setup().getEnclosedIds({ minX: 80, minY: 180, maxX: 150, maxY: 220 })).toEqual([1]);
  });
  it("getEnclosedIds excludes the line when its anchor is outside the rect", () => {
    expect(setup().getEnclosedIds({ minX: 300, minY: 300, maxX: 400, maxY: 400 })).toEqual([]);
  });
  it("hitTest near anchor dot returns move cursor with vline-anchor externalId", () => {
    // dist((101,202) → (100,200)) ≈ 2.24 ≤ HIT_TOLERANCE*2=10 → anchor hit
    expect(setup().hitTest(101, 202)).toEqual({ cursorStyle: "move", externalId: "vline-anchor:1", zOrder: "normal" });
  });
  it("hitTest on the line away from anchor returns pointer cursor with vline externalId", () => {
    // dist((102,500) → (100,200)) ≈ 300 > 10 → not anchor; |102-100|=2 ≤ HIT_TOLERANCE=5 → line hit
    expect(setup().hitTest(102, 500)).toEqual({ cursorStyle: "pointer", externalId: "vline:1", zOrder: "normal" });
  });
  it("hitTest clear miss returns null", () => {
    // |140-100|=40 > HIT_TOLERANCE=5; dist to anchor ≈ 303 > 10
    expect(setup().hitTest(140, 500)).toBeNull();
  });
});
