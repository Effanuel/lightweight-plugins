import { describe, it, expect } from "vitest";
import { lineBitmapWidth, crispLineCenterY, crispRect } from "./chart-drawing";

// ---------------------------------------------------------------------------
// lineBitmapWidth
// ---------------------------------------------------------------------------

describe("lineBitmapWidth", () => {
  it("rounds media width to whole bitmap pixels", () => {
    expect(lineBitmapWidth(1, 1)).toBe(1);
    expect(lineBitmapWidth(1, 2)).toBe(2);
    expect(lineBitmapWidth(1, 1.5)).toBe(2);
    expect(lineBitmapWidth(2, 1.25)).toBe(3);
  });

  it("never returns less than 1 pixel", () => {
    expect(lineBitmapWidth(1, 0.3)).toBe(1);
    expect(lineBitmapWidth(0, 1)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// crispLineCenterY
// ---------------------------------------------------------------------------

describe("crispLineCenterY", () => {
  it("snaps a 1px stroke so it covers exactly one pixel row (center at n+0.5)", () => {
    expect(crispLineCenterY(10.0, 1)).toBe(10.5);
    expect(crispLineCenterY(10.3, 1)).toBe(10.5);
    expect(crispLineCenterY(10.7, 1)).toBe(11.5);
  });

  it("snaps a 2px stroke to an integer center (covers two whole rows)", () => {
    expect(crispLineCenterY(10.3, 2)).toBe(10);
    expect(crispLineCenterY(10.6, 2)).toBe(11);
  });

  it("always places the stroke's top edge on an integer pixel boundary", () => {
    for (const width of [1, 2, 3, 4]) {
      for (const y of [0, 5.1, 5.49, 5.5, 5.99, 123.456]) {
        const center = crispLineCenterY(y, width);
        expect(Number.isInteger(center - width / 2)).toBe(true);
      }
    }
  });

  it("never shifts the line by more than one pixel", () => {
    for (const width of [1, 2, 3]) {
      for (const y of [0.1, 7.7, 50.5, 999.9]) {
        expect(Math.abs(crispLineCenterY(y, width) - y)).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// crispRect
// ---------------------------------------------------------------------------

describe("crispRect", () => {
  it("snaps fill-only rects (strokeBm=0) to integer edges", () => {
    expect(crispRect(10.3, 5.7, 50.5, 80.2, 0)).toEqual({ left: 10, top: 6, right: 51, bottom: 80 });
  });

  it("snaps bordered rect edges to 1px stroke centers (n+0.5)", () => {
    expect(crispRect(10.3, 5.7, 50.4, 80.2, 1)).toEqual({ left: 10.5, top: 6.5, right: 50.5, bottom: 80.5 });
  });

  it("places every edge's stroke boundary on integer pixels", () => {
    for (const stroke of [1, 2, 3, 4]) {
      const r = crispRect(10.3, 5.7, 50.5, 80.2, stroke);
      for (const edge of [r.left, r.top, r.right, r.bottom]) {
        expect(Number.isInteger(edge - stroke / 2)).toBe(true);
      }
    }
  });

  it("never shifts an edge by more than one pixel", () => {
    for (const stroke of [0, 1, 2, 3]) {
      const r = crispRect(10.1, 7.7, 50.5, 999.9, stroke);
      expect(Math.abs(r.left - 10.1)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.top - 7.7)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.right - 50.5)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.bottom - 999.9)).toBeLessThanOrEqual(1);
    }
  });

  it("does not invert degenerate rects", () => {
    const r = crispRect(10.2, 10.2, 10.2, 10.2, 1);
    expect(r.right).toBeGreaterThanOrEqual(r.left);
    expect(r.bottom).toBeGreaterThanOrEqual(r.top);
  });

  it("preserves ordering for near-zero-area rects where snapping collapses both edges", () => {
    const r = crispRect(9.6, 9.6, 10.4, 10.4, 1);
    expect(r.right).toBeGreaterThanOrEqual(r.left);
    expect(r.bottom).toBeGreaterThanOrEqual(r.top);
  });
});

// ---------------------------------------------------------------------------
