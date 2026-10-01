// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IChartApi, ISeriesApi, ISeriesPrimitive, SeriesType, Time } from "lightweight-charts";
import { DrawingManager, type Drawing } from "./drawing-manager";

const STYLE = { width: 1, color: "#ffffff", pattern: "solid" as const, opacity: 1 };

/**
 * A fake chart whose single pane is an 800×400 element at the page origin.
 * x maps to logical index x (bars every 10s from time 0), y maps to price y.
 */
function fakeChart(opts: { minMove?: number; data?: { time: number }[] } = {}) {
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

  const chart = {
    chartElement: () => container,
    panes: () => [{ getHTMLElement: () => pane, getSeries: () => [series] }],
    applyOptions: vi.fn(),
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
    // The paste becomes the marquee selection (terminal keeps the source's single selection too).
    expect(m.getSelection().map((d) => d.id)).toContain(2);
    m.deleteSelected(); // the marquee selection owns the delete, as with the Delete key
    expect(m.getDrawings().map((d) => d.id)).toEqual([1]);
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
