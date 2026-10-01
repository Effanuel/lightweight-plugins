// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IChartApi, ISeriesApi, ISeriesPrimitive, SeriesType, Time } from "lightweight-charts";
import { DrawingManager, type Drawing } from "./drawing-manager";

const STYLE = { width: 1, color: "#ffffff", pattern: "solid" as const, opacity: 1 };

type Opts = Record<string, unknown>;
const isPlainObj = (v: unknown): v is Opts => typeof v === "object" && v !== null;

function mergeInto(dst: Opts, src: Opts): void {
  for (const [k, v] of Object.entries(src)) {
    if (isPlainObj(v) && isPlainObj(dst[k])) mergeInto(dst[k], v);
    else dst[k] = isPlainObj(v) ? structuredClone(v) : v;
  }
}

function expandScrollScale(patch: Opts): Opts {
  const { handleScroll: scroll, handleScale: scale } = patch;
  return {
    ...patch,
    ...(typeof scroll === "boolean" && { handleScroll: { mouseWheel: scroll, pressedMouseMove: scroll } }),
    ...(typeof scale === "boolean" && { handleScale: { mouseWheel: scale, axisPressedMouseMove: scale } }),
  };
}

/**
 * A fake chart whose single pane is an 800×400 element at the page origin.
 * x maps to logical index x (bars every 10s from time 0), y maps to price y.
 */
function fakeChart(opts: { minMove?: number; data?: { time: number }[]; options?: Record<string, unknown> } = {}) {
  const container = document.createElement("div");
  const pane = document.createElement("div");
  container.appendChild(pane);
  document.body.appendChild(container);
  pane.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 400, right: 900, bottom: 400, x: 0, y: 0, toJSON() {} });
  container.getBoundingClientRect = pane.getBoundingClientRect;

  let data = opts.data ?? Array.from({ length: 100 }, (_, i) => ({ time: i * 10 }));
  const dataListeners = new Set<() => void>();
  const clickListeners = new Set<(p: unknown) => void>();
  const attached: ISeriesPrimitive<Time>[] = [];
  // Like lightweight-charts: options() hands out the live object, and applyOptions
  // expands a boolean handleScroll/handleScale into per-input flags merged into it in place.
  const liveOptions: Record<string, unknown> = {};
  const applyOptions = (patch: Record<string, unknown>) => mergeInto(liveOptions, expandScrollScale(patch));
  applyOptions(opts.options ?? { handleScroll: true, handleScale: true });

  const chart = {
    chartElement: () => container,
    panes: () => [{ getHTMLElement: () => pane, getSeries: () => [series] }],
    options: () => liveOptions,
    applyOptions: vi.fn(applyOptions),
    timeScale: () => ({
      width: () => 800,
      coordinateToLogical: (x: number) => x,
      timeToCoordinate: (t: number) => t / 10,
      getVisibleLogicalRange: () => ({ from: 0, to: 80 }),
    }),
    subscribeClick: (fn: (p: unknown) => void) => clickListeners.add(fn),
    unsubscribeClick: (fn: (p: unknown) => void) => clickListeners.delete(fn),
  } as unknown as IChartApi;

  const series = {
    options: () => ({ priceFormat: { type: "price", minMove: opts.minMove ?? 0.01 } }),
    data: () => data,
    subscribeDataChanged: (fn: () => void) => dataListeners.add(fn),
    unsubscribeDataChanged: (fn: () => void) => dataListeners.delete(fn),
    priceToCoordinate: (p: number) => p,
    coordinateToPrice: (c: number) => c,
    attachPrimitive: (p: ISeriesPrimitive<Time>) => {
      attached.push(p);
      // Like lightweight-charts: a primitive's requestUpdate re-runs its views.
      p.attached?.({ chart, series, requestUpdate: () => p.updateAllViews?.() } as never);
    },
    detachPrimitive: (p: ISeriesPrimitive<Time>) => {
      attached.splice(attached.indexOf(p), 1);
      p.detached?.();
    },
  } as unknown as ISeriesApi<SeriesType>;

  const setData = (next: { time: number }[]) => {
    data = next;
    for (const fn of [...dataListeners]) fn();
  };
  return { chart, series, container, pane, attached, clickListeners, setData };
}

const fire = (el: EventTarget, type: string, init: MouseEventInit & KeyboardEventInit = {}) =>
  el.dispatchEvent(
    type === "keydown"
      ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
      : new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }),
  );
const flush = () => new Promise<void>((r) => queueMicrotask(r));

let managers: DrawingManager[] = [];
const make = (...args: ConstructorParameters<typeof DrawingManager>) => {
  const m = new DrawingManager(...args);
  managers.push(m);
  return m;
};
beforeEach(() => {
  managers = [];
});
afterEach(() => {
  for (const m of managers) m.destroy();
  document.body.innerHTML = "";
});

const hline = (id: number, price = 50): Drawing => ({ kind: "h-line", id, price, time: 100, style: { ...STYLE } });

describe("DrawingManager", () => {
  test("setTool arms a tool and emits toolChange", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    const seen: (string | null)[] = [];
    m.on("toolChange", (t) => seen.push(t));
    m.setTool("trend");
    m.setTool(null);
    expect(m.getTool()).toBeNull();
    expect(seen).toEqual(["trend", null]);
  });

  test("clicking with the h-line tool adds one h-line at the clicked price, then disarms", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    const change = vi.fn();
    m.on("change", change);
    m.setTool("h-line");
    fire(f.pane, "mousedown", { clientX: 100, clientY: 123.456 });
    const drawings = m.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]).toMatchObject({ kind: "h-line", price: 123.46 });
    expect(m.getTool()).toBeNull();
    expect(change).toHaveBeenCalled();
  });

  test("tickSize defaults to the series minMove", () => {
    const f = fakeChart({ minMove: 0.25 });
    const m = make(f.chart, f.series);
    m.setTool("h-line");
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50.3 });
    expect(m.getDrawings()[0]).toMatchObject({ price: 50.25 });
  });

  test("bars follow series data changes", () => {
    const f = fakeChart({ data: [] });
    const m = make(f.chart, f.series);
    f.setData(Array.from({ length: 50 }, (_, i) => ({ time: 1000 + i * 60 })));
    m.setTool("v-line");
    fire(f.pane, "mousedown", { clientX: 3, clientY: 50 });
    expect(m.getDrawings()[0]).toMatchObject({ kind: "v-line", time: 1180 });
  });

  test("getDrawings and setDrawings round-trip and clear history", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    const saved: Drawing[] = [
      hline(3),
      { kind: "trend", id: 5, p1: { price: 10, time: 0 }, p2: { price: 20, time: 100 }, style: { ...STYLE } },
      { kind: "box", id: 7, p1: { price: 10, time: 0 }, p2: { price: 20, time: 100 }, style: { borderColor: "#fff", borderWidth: 1, borderOpacity: 1, bgColor: "#000", bgOpacity: 0.1 } },
    ];
    m.setDrawings(saved);
    expect(m.getDrawings()).toEqual(saved);
    expect(m.undo()).toBe(false);
  });

  test("setDrawings rejects an unknown kind and keeps the current drawings", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1)]);
    expect(() => m.setDrawings([{ ...hline(2), kind: "circle" } as unknown as Drawing])).toThrow(/unknown drawing kind "circle"/i);
    expect(m.getDrawings()).toEqual([hline(1)]);
  });

  test("setDrawings rejects duplicate and non-integer ids", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    expect(() => m.setDrawings([hline(1), hline(1)])).toThrow(/duplicate drawing id 1/i);
    expect(() => m.setDrawings([hline(1.5)])).toThrow(/invalid drawing id/i);
    expect(m.getDrawings()).toEqual([]);
  });

  test("clear is one undo step", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1), hline(2)]);
    m.clear();
    expect(m.getDrawings()).toEqual([]);
    expect(m.undo()).toBe(true);
    expect(m.getDrawings()).toHaveLength(2);
    expect(m.redo()).toBe(true);
    expect(m.getDrawings()).toEqual([]);
  });

  test("setHidden hides without deleting", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1)]);
    m.setHidden(true);
    expect(m.isHidden()).toBe(true);
    expect(m.getDrawings()).toHaveLength(1);
  });

  test("selecting a drawing by click, then setStyle applies only the keys its style has, as one step", async () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1, 50)]);
    const sel = vi.fn();
    m.on("selectionChange", sel);
    fire(f.pane, "mousemove", { clientX: 100, clientY: 50 });
    await flush();
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    fire(window, "mouseup", { clientX: 100, clientY: 50 });
    expect(m.getSelection().map((d) => d.id)).toEqual([1]);
    expect(sel).toHaveBeenCalled();
    m.setStyle({ color: "#ff0000", bgColor: "#00ff00" });
    expect(m.getDrawings()[0].style).toEqual({ ...STYLE, color: "#ff0000" });
    m.undo();
    expect(m.getDrawings()[0].style).toEqual(STYLE);
  });

  test("deleteSelected, then copy and paste", async () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1, 50)]);
    fire(f.pane, "mousemove", { clientX: 100, clientY: 50 });
    await flush();
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    fire(window, "mouseup", { clientX: 100, clientY: 50 });
    expect(m.copy()).toBe(true);
    expect(m.paste()).toBe(true);
    expect(m.getDrawings()).toHaveLength(2);
    // The paste becomes the marquee selection and the source stays singly selected.
    expect(m.getSelection().map((d) => d.id)).toEqual([1, 2]);
    m.deleteSelected();
    expect(m.getDrawings()).toEqual([]);
    expect(m.undo()).toBe(true);
    expect(m.getDrawings()).toHaveLength(2);
  });

  test("deleteSelected removes everything getSelection reports, as one undo step", async () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1, 50)]);
    fire(f.pane, "mousemove", { clientX: 100, clientY: 50 });
    await flush();
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    fire(window, "mouseup", { clientX: 100, clientY: 50 });
    m.setTool("v-line");
    fire(f.pane, "mousedown", { clientX: 30, clientY: 200 });
    expect(m.getSelection()).toHaveLength(2);
    m.deleteSelected();
    expect(m.getDrawings()).toHaveLength(0);
    expect(m.getSelection()).toEqual([]);
    expect(m.undo()).toBe(true);
    expect(m.getDrawings()).toHaveLength(2);
  });

  test("clear drops the selection and emits selectionChange", async () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1, 50)]);
    fire(f.pane, "mousemove", { clientX: 100, clientY: 50 });
    await flush();
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    fire(window, "mouseup", { clientX: 100, clientY: 50 });
    expect(m.getSelection()).toHaveLength(1);
    const sel = vi.fn();
    m.on("selectionChange", sel);
    m.clear();
    expect(sel).toHaveBeenLastCalledWith([]);
    expect(m.getSelection()).toEqual([]);
  });

  test("setDrawings validates fully: a malformed list throws and changes nothing", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1)]);
    m.clear();
    const noStyle = { kind: "h-line", id: 1, price: 50, time: 100 } as unknown as Drawing;
    expect(() => m.setDrawings([noStyle])).toThrow(/invalid h-line drawing 1/i);
    expect(m.getDrawings()).toEqual([]);
    expect(m.undo()).toBe(true); // history untouched: the clear is still undoable
    expect(m.getDrawings()).toEqual([hline(1)]);
    expect(() => m.setDrawings([{ ...hline(2), kind: "constructor" } as unknown as Drawing])).toThrow(/unknown drawing kind/i);
    expect(() => m.setDrawings([hline(2 ** 60)])).toThrow(/invalid drawing id/i);
    const badTrend = { kind: "trend", id: 3, p1: { price: 1, time: 0 }, p2: { price: Number.NaN, time: 1 }, style: { ...STYLE } } as Drawing;
    expect(() => m.setDrawings([badTrend])).toThrow(/invalid trend drawing 3/i);
    m.setDrawings([hline(4)]);
    expect(m.getDrawings()).toEqual([hline(4)]);
  });

  test("setDrawings rejects malformed fibonacci levels and keeps the current drawings", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1)]);
    const fib = (levels: unknown) =>
      ({ kind: "fibonacci", id: 2, p1: { price: 10, time: 0 }, p2: { price: 20, time: 100 }, style: { ...STYLE }, levels }) as Drawing;
    expect(() => m.setDrawings([fib([null])])).toThrow(/invalid fibonacci drawing 2: levels\[0\]/i);
    expect(() => m.setDrawings([fib([{ value: 0, visible: true }, { value: Number.NaN, visible: true }])])).toThrow(/levels\[1\]/);
    expect(() => m.setDrawings([fib([{ value: 1, visible: "yes" }])])).toThrow(/levels\[0\]/);
    expect(() => m.setDrawings([fib([{ value: 1, visible: true, color: 5 }])])).toThrow(/levels\[0\]/);
    expect(() => m.setDrawings([{ ...fib([]), style: undefined } as unknown as Drawing])).toThrow(/style must be an object/);
    expect(m.getDrawings()).toEqual([hline(1)]);
    const valid = fib([{ value: 0, visible: true }, { value: 1.618, visible: false, color: "#ff0000" }]);
    m.setDrawings([valid]);
    expect(m.getDrawings()).toEqual([valid]);
  });

  test("scroll lock restores the chart's own handleScroll/handleScale on unlock", () => {
    const f = fakeChart({ options: { handleScroll: false, handleScale: { mouseWheel: true, axisPressedMouseMove: false } } });
    const original = structuredClone(f.chart.options());
    const m = make(f.chart, f.series);
    m.setTool("trend");
    fire(f.pane, "mousedown", { clientX: 10, clientY: 50 }); // the anchor click locks
    expect(f.chart.applyOptions).toHaveBeenLastCalledWith({ handleScroll: false, handleScale: false });
    m.setTool(null); // cancels the anchor, unlocking
    expect(f.chart.applyOptions).toHaveBeenLastCalledWith(original);
    expect(f.chart.options()).toEqual(original);
  });

  test("arming and disarming without a click never re-enables scrolling", () => {
    const f = fakeChart({ options: { handleScroll: false, handleScale: false } });
    const m = make(f.chart, f.series);
    m.setTool("trend");
    m.setTool(null);
    m.setTool("measure");
    m.setTool(null);
    m.destroy();
    managers = managers.filter((x) => x !== m);
    for (const [patch] of vi.mocked(f.chart.applyOptions).mock.calls) {
      expect(patch).not.toMatchObject({ handleScroll: true });
    }
  });

  test("Ctrl+C with page text selected copies the text, not the selected drawing", async () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setDrawings([hline(1, 50)]);
    fire(f.pane, "mousemove", { clientX: 100, clientY: 50 });
    await flush();
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    fire(window, "mouseup", { clientX: 100, clientY: 50 });
    expect(m.getSelection()).toHaveLength(1);
    const text = document.body.appendChild(document.createElement("p"));
    text.textContent = "some page text";
    const range = document.createRange();
    range.selectNodeContents(text);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    const e = new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(m.paste()).toBe(false);
    document.getSelection()!.removeAllRanges(); // no page text: Ctrl+C copies the drawing
    expect(fire(document, "keydown", { key: "c", ctrlKey: true })).toBe(false); // false = default prevented
    expect(m.paste()).toBe(true);
  });

  test("keyboard: Ctrl+Z undoes, Delete deletes the selection", async () => {
    const f = fakeChart();
    const m = make(f.chart, f.series);
    m.setTool("h-line");
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    expect(m.getDrawings()).toHaveLength(1);
    fire(document, "keydown", { key: "Delete" });
    expect(m.getDrawings()).toHaveLength(0);
    fire(document, "keydown", { key: "z", ctrlKey: true });
    expect(m.getDrawings()).toHaveLength(1);
  });

  test("two managers: keys go only to the last-clicked chart", () => {
    const a = fakeChart();
    const b = fakeChart();
    const ma = make(a.chart, a.series);
    const mb = make(b.chart, b.series);
    ma.setTool("h-line");
    fire(a.pane, "mousedown", { clientX: 100, clientY: 50 });
    mb.setTool("h-line");
    fire(b.pane, "mousedown", { clientX: 100, clientY: 60 });
    fire(document, "keydown", { key: "z", ctrlKey: true });
    expect(ma.getDrawings()).toHaveLength(1);
    expect(mb.getDrawings()).toHaveLength(0);
  });

  test("keyboard: false leaves keys to the app", () => {
    const f = fakeChart();
    const m = make(f.chart, f.series, { keyboard: false });
    m.setTool("h-line");
    fire(f.pane, "mousedown", { clientX: 100, clientY: 50 });
    fire(document, "keydown", { key: "z", ctrlKey: true });
    expect(m.getDrawings()).toHaveLength(1);
  });

  test("destroy removes every listener", () => {
    const f = fakeChart();
    const m = new DrawingManager(f.chart, f.series);
    m.setDrawings([hline(1)]);
    m.destroy();
    expect(f.attached).toHaveLength(0);
    expect(f.clickListeners.size).toBe(0);
    m.setTool("h-line");
    fire(f.pane, "mousedown", { clientX: 100, clientY: 70 });
    fire(document, "keydown", { key: "z", ctrlKey: true });
    expect(m.getDrawings()).toEqual([hline(1)]);
  });
});
