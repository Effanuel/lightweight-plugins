import { beforeEach, describe, expect, it } from "vitest";
import { createClipboard, emptySelection, type Clipboard, type DrawingSelection } from "./drawing-clipboard";

const empty: DrawingSelection = {
  box: [], path: [], freedraw: [], fib: [], ray: [], trend: [], hline: [], vline: [],
};

const sample: DrawingSelection = {
  box: [{ id: 1, p1: { price: 1, time: 1 }, p2: { price: 2, time: 2 }, style: {} as never }],
  path: [],
  freedraw: [],
  fib: [],
  ray: [],
  trend: [],
  hline: [],
  vline: [],
};

describe("drawing-clipboard", () => {
  let clipboard: Clipboard;
  beforeEach(() => {
    clipboard = createClipboard();
    clipboard.set(empty);
  });

  it("reports empty after setting an empty selection", () => {
    expect(clipboard.has()).toBe(false);
    expect(clipboard.get()).toEqual(empty);
  });

  it("round-trips a selection", () => {
    clipboard.set(sample);
    expect(clipboard.has()).toBe(true);
    expect(clipboard.get()?.box[0].id).toBe(1);
  });

  it("isolates the snapshot from later mutation of the source", () => {
    const src: DrawingSelection = {
      box: [{ id: 9, p1: { price: 1, time: 1 }, p2: { price: 2, time: 2 }, style: {} as never }],
      path: [],
      freedraw: [],
      fib: [],
      ray: [],
      trend: [],
      hline: [],
      vline: [],
        };
    clipboard.set(src);
    src.box[0].p1.price = 999;
    expect(clipboard.get()?.box[0].p1.price).toBe(1);
  });

  it("isolates returned snapshots from each other", () => {
    clipboard.set(sample);
    const a = clipboard.get()!;
    a.box[0].p1.price = 777;
    expect(clipboard.get()?.box[0].p1.price).toBe(1);
  });

  it("two clipboards are independent", () => {
    const a = createClipboard();
    const b = createClipboard();
    const sel = emptySelection();
    sel.hline.push({ id: 1, price: 1, time: 1, style: { width: 1, color: "#fff", pattern: "solid", opacity: 1 } });
    a.set(sel);
    expect(a.has()).toBe(true);
    expect(b.has()).toBe(false);
  });
});
