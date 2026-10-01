import { describe, expect, test, vi } from "vitest";
import { DrawingStore } from "./drawing-store";
import { emptyBucket } from "../model";
import type { HLineData } from "../primitives/HorizontalLinePrimitive";

const STYLE = { width: 1, color: "#fff", pattern: "solid" as const, opacity: 1 };
const line = (id: number, price = 10): HLineData => ({ id, price, time: 100, style: { ...STYLE } });

describe("DrawingStore", () => {
  test("ids increase from 1", () => {
    const s = new DrawingStore();
    expect([s.generateId(), s.generateId()]).toEqual([1, 2]);
  });

  test("add, update and remove go through the slice", () => {
    const s = new DrawingStore();
    const slice = s.slice("hline");
    slice.add(line(1));
    slice.update(1, { price: 20 });
    expect(s.items("hline")).toEqual([line(1, 20)]);
    slice.remove(1);
    expect(s.items("hline")).toEqual([]);
  });

  test("setHidden hides without touching drawings", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.setHidden(true);
    expect(s.isHidden()).toBe(true);
    expect(s.items("hline")).toEqual([line(1)]);
  });

  test("clearAll removes everything and unhides", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.add("trend", { id: 2, p1: { price: 1, time: 1 }, p2: { price: 2, time: 2 }, style: { ...STYLE } });
    s.setHidden(true);
    s.clearAll();
    expect(s.items("hline")).toEqual([]);
    expect(s.items("trend")).toEqual([]);
    expect(s.isHidden()).toBe(false);
  });

  test("subscribers get (state, prev) on every change", () => {
    const s = new DrawingStore();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.add("hline", line(1));
    expect(fn).toHaveBeenCalledTimes(1);
    const [state, prev] = fn.mock.calls[0];
    expect(state.bucket.hline).toHaveLength(1);
    expect(prev.bucket.hline).toHaveLength(0);
    off();
    s.add("hline", line(2));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("load replaces drawings, continues ids, bumps loadVersion; plain writes don't", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    expect(s.getState().loadVersion).toBe(0);
    const bucket = emptyBucket();
    bucket.hline.push(line(7));
    s.load(bucket);
    expect(s.items("hline")).toEqual([line(7)]);
    expect(s.generateId()).toBe(8);
    expect(s.getState().loadVersion).toBe(1);
  });
});
