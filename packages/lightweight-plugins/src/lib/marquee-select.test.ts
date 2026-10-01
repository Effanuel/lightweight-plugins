import { describe, expect, it } from "vitest";
import {
  bboxFullyInside,
  pointInRect,
  rectFromPoints,
  rectIsMeaningful,
  type PixelRect,
} from "./marquee-select";

const RECT: PixelRect = { minX: 10, minY: 10, maxX: 100, maxY: 100 };

describe("rectFromPoints", () => {
  it("normalizes corners regardless of drag direction", () => {
    expect(rectFromPoints(100, 80, 20, 10)).toEqual({ minX: 20, minY: 10, maxX: 100, maxY: 80 });
    expect(rectFromPoints(20, 10, 100, 80)).toEqual({ minX: 20, minY: 10, maxX: 100, maxY: 80 });
  });
});

describe("pointInRect", () => {
  it("includes interior and edge points", () => {
    expect(pointInRect(50, 50, RECT)).toBe(true);
    expect(pointInRect(10, 10, RECT)).toBe(true); // corner
    expect(pointInRect(100, 50, RECT)).toBe(true); // edge
  });

  it("excludes points outside", () => {
    expect(pointInRect(5, 50, RECT)).toBe(false);
    expect(pointInRect(50, 101, RECT)).toBe(false);
  });
});

describe("bboxFullyInside", () => {
  it("is true only when the whole bbox is contained", () => {
    expect(bboxFullyInside(20, 20, 80, 80, RECT)).toBe(true);
    expect(bboxFullyInside(10, 10, 100, 100, RECT)).toBe(true); // flush with edges
  });

  it("is false when any edge pokes out", () => {
    expect(bboxFullyInside(5, 20, 80, 80, RECT)).toBe(false); // left out
    expect(bboxFullyInside(20, 20, 120, 80, RECT)).toBe(false); // right out
    expect(bboxFullyInside(20, 20, 80, 140, RECT)).toBe(false); // bottom out
  });
});

describe("rectIsMeaningful", () => {
  it("rejects tiny rects (treated as a click)", () => {
    expect(rectIsMeaningful({ minX: 10, minY: 10, maxX: 11, maxY: 60 })).toBe(false);
    expect(rectIsMeaningful({ minX: 10, minY: 10, maxX: 60, maxY: 11 })).toBe(false);
  });

  it("accepts rects above the min size on both axes", () => {
    expect(rectIsMeaningful({ minX: 10, minY: 10, maxX: 60, maxY: 60 })).toBe(true);
  });
});
