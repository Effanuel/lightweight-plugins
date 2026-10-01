import { describe, expect, it } from "vitest";
import { cloneBox, cloneFib, cloneHLine, clonePath, cloneRay, cloneTrend, cloneVLine, NO_OFFSET, CLONE_BY_KIND } from "./drawing-clone";
import type { BoxData, FibData } from "../model";
import type { PathData } from "../primitives/PathToolPrimitive";
import type { RayData } from "../primitives/HorizontalRayPrimitive";
import type { TrendData } from "../primitives/TrendLinePrimitive";
import type { HLineData } from "../primitives/HorizontalLinePrimitive";
import type { VLineData } from "../primitives/VerticalLinePrimitive";

const box: BoxData = {
  id: 1,
  p1: { price: 100, time: 1000 },
  p2: { price: 200, time: 2000 },
  style: { borderColor: "#fff", borderWidth: 1, borderOpacity: 1, bgColor: "#000", bgOpacity: 0.1 },
};

const fib: FibData = {
  id: 2,
  p1: { price: 100, time: 1000 },
  p2: { price: 200, time: 2000 },
  style: { width: 1, color: "#fff", pattern: "solid", opacity: 1 },
};

const path: PathData = {
  id: 3,
  points: [{ price: 100, time: 1000 }, { price: 150, time: 1500 }],
  hasArrow: true,
  style: { width: 1, color: "#fff", pattern: "solid", opacity: 1 },
};

const ray: RayData = {
  id: 4,
  price: 100,
  time: 1000,
  style: { width: 1, color: "#fff", pattern: "solid", opacity: 1 },
};

const trend: TrendData = {
  id: 5,
  p1: { price: 100, time: 1000 },
  p2: { price: 200, time: 2000 },
  style: { width: 1, color: "#fff", pattern: "solid", opacity: 1 },
};

const hline: HLineData = {
  id: 6,
  price: 100,
  time: 1000,
  style: { width: 1, color: "#fff", pattern: "solid", opacity: 1 },
};

const vline: VLineData = {
  id: 7,
  time: 1000,
  price: 100,
  style: { width: 1, color: "#fff", pattern: "solid", opacity: 1 },
};

describe("drawing-clone", () => {
  it("clones a box with a new id and applies the offset", () => {
    const clone = cloneBox(box, 42, { priceDelta: 10, timeDelta: 5 });
    expect(clone.id).toBe(42);
    expect(clone.p1).toEqual({ price: 110, time: 1005 });
    expect(clone.p2).toEqual({ price: 210, time: 2005 });
  });

  it("clones a fib with a new id and applies the offset", () => {
    const clone = cloneFib(fib, 43, { priceDelta: -10, timeDelta: 0 });
    expect(clone.id).toBe(43);
    expect(clone.p1.price).toBe(90);
    expect(clone.p2.price).toBe(190);
  });

  it("clones a fib's level overrides without sharing them", () => {
    const configured = { ...fib, levels: [{ value: 0.618, visible: false, color: "#ff0000" }] };
    const clone = cloneFib(configured, 43, NO_OFFSET);
    expect(clone.levels).toEqual(configured.levels);
    expect(clone.levels?.[0]).not.toBe(configured.levels[0]);
  });

  it("leaves an unset level override unset, so the clone keeps drawing the defaults", () => {
    expect(cloneFib(fib, 43, NO_OFFSET).levels).toBeUndefined();
  });

  it("clones a path offsetting every point", () => {
    const clone = clonePath(path, 44, { priceDelta: 1, timeDelta: 2 });
    expect(clone.id).toBe(44);
    expect(clone.points).toEqual([{ price: 101, time: 1002 }, { price: 151, time: 1502 }]);
    expect(clone.hasArrow).toBe(true);
  });

  it("clones a ray with a new id and applies the offset", () => {
    const clone = cloneRay(ray, 45, { priceDelta: 5, timeDelta: 5 });
    expect(clone.id).toBe(45);
    expect(clone.price).toBe(105);
    expect(clone.time).toBe(1005);
  });

  it("clones a trend line offsetting both endpoints", () => {
    const clone = cloneTrend(trend, 48, { priceDelta: 10, timeDelta: 5 });
    expect(clone.id).toBe(48);
    expect(clone.p1).toEqual({ price: 110, time: 1005 });
    expect(clone.p2).toEqual({ price: 210, time: 2005 });
  });

  it("clones a horizontal line applying the offset", () => {
    const clone = cloneHLine(hline, 49, { priceDelta: 5, timeDelta: 5 });
    expect(clone.id).toBe(49);
    expect(clone.price).toBe(105);
    expect(clone.time).toBe(1005);
  });

  it("clones a vertical line applying the offset", () => {
    const clone = cloneVLine(vline, 50, { priceDelta: 5, timeDelta: 5 });
    expect(clone.id).toBe(50);
    expect(clone.time).toBe(1005);
    expect(clone.price).toBe(105);
  });

  it("does not mutate the original drawing", () => {
    cloneBox(box, 46, { priceDelta: 10, timeDelta: 10 });
    expect(box.p1).toEqual({ price: 100, time: 1000 });
    expect(box.p2).toEqual({ price: 200, time: 2000 });
    expect(box.style).toEqual({ borderColor: "#fff", borderWidth: 1, borderOpacity: 1, bgColor: "#000", bgOpacity: 0.1 });
    expect(box.id).toBe(1);
  });

  it("NO_OFFSET produces a positional copy in place", () => {
    const clone = cloneBox(box, 47, NO_OFFSET);
    expect(clone.p1).toEqual(box.p1);
    expect(clone.p2).toEqual(box.p2);
    expect(clone.id).toBe(47);
  });
});

describe("CLONE_BY_KIND", () => {
  it("has an entry per drawing kind and clones with a new id + offset", () => {
    const box = CLONE_BY_KIND.box(
      { id: 1, p1: { price: 1, time: 1 }, p2: { price: 2, time: 2 }, style: {} as never },
      42,
      { priceDelta: 10, timeDelta: 5 },
    );
    expect(box.id).toBe(42);
    expect(box.p1.price).toBe(11);
    expect(box.p2.time).toBe(7);

    const ray = CLONE_BY_KIND.ray({ id: 3, price: 100, time: 9, style: {} as never }, 7, NO_OFFSET);
    expect(ray.id).toBe(7);
    expect(ray.price).toBe(100);
  });
});
