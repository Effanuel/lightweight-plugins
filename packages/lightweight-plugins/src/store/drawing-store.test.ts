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

  test("each bare write is one undo step; redo reapplies it", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.update("hline", 1, { price: 20 });
    expect(s.undo()).toBe(true);
    expect(s.items("hline")).toEqual([line(1, 10)]);
    expect(s.undo()).toBe(true);
    expect(s.items("hline")).toEqual([]);
    expect(s.undo()).toBe(false);
    expect(s.redo()).toBe(true);
    expect(s.items("hline")).toEqual([line(1, 10)]);
  });

  test("edit groups several writes into one step; nested edits join it", () => {
    const s = new DrawingStore();
    s.edit(() => {
      s.add("hline", line(1));
      s.edit(() => s.add("hline", line(2)));
    });
    s.undo();
    expect(s.items("hline")).toEqual([]);
  });

  test("beginEdit/endEdit span a gesture, and undo refuses while it is open", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.beginEdit();
    s.update("hline", 1, { price: 11 });
    s.update("hline", 1, { price: 12 });
    expect(s.undo()).toBe(false);
    s.endEdit();
    s.undo();
    expect(s.items("hline")).toEqual([line(1, 10)]);
  });

  test("edits with the same mergeKey merge into one step", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.edit(() => s.update("hline", 1, { price: 11 }), "popup:1");
    s.edit(() => s.update("hline", 1, { price: 12 }), "popup:1");
    s.undo();
    expect(s.items("hline")).toEqual([line(1, 10)]);
  });

  test("untracked writes are not undoable", () => {
    const s = new DrawingStore();
    s.untracked(() => s.add("hline", line(1)));
    expect(s.undo()).toBe(false);
  });

  test("undo is refused while hidden", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.setHidden(true);
    expect(s.undo()).toBe(false);
  });

  test("clearAll removes everything as one step and unhides", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    s.add("trend", { id: 2, p1: { price: 1, time: 1 }, p2: { price: 2, time: 2 }, style: { ...STYLE } });
    s.setHidden(true);
    s.clearAll();
    expect(s.items("hline")).toEqual([]);
    expect(s.isHidden()).toBe(false);
    s.undo();
    expect(s.items("hline")).toHaveLength(1);
    expect(s.items("trend")).toHaveLength(1);
  });

  test("undo bumps historyVersion; plain writes don't", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    expect(s.getState().historyVersion).toBe(0);
    s.undo();
    expect(s.getState().historyVersion).toBe(1);
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

  test("load replaces drawings, clears history, continues ids, bumps historyVersion", () => {
    const s = new DrawingStore();
    s.add("hline", line(1));
    const bucket = emptyBucket();
    bucket.hline.push(line(7));
    s.load(bucket);
    expect(s.items("hline")).toEqual([line(7)]);
    expect(s.undo()).toBe(false);
    expect(s.generateId()).toBe(8);
    expect(s.getState().historyVersion).toBe(1);
  });

  test("the undo history keeps the last 100 steps", () => {
    const s = new DrawingStore();
    for (let i = 1; i <= 105; i++) s.add("hline", line(i));
    let undone = 0;
    while (s.undo()) undone++;
    expect(undone).toBe(100);
    expect(s.items("hline")).toHaveLength(5);
  });

  test("undo works without Map.groupBy (Safari < 17.4)", () => {
    const groupBy = Map.groupBy;
    try {
      delete (Map as { groupBy?: unknown }).groupBy;
      const s = new DrawingStore();
      s.add("hline", line(1));
      s.update("hline", 1, { price: 20 });
      expect(s.undo()).toBe(true);
      expect(s.items("hline")).toEqual([line(1, 10)]);
    } finally {
      Map.groupBy = groupBy;
    }
  });
});
