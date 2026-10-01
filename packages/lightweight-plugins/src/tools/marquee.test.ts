import { beforeEach, describe, expect, test, vi } from "vitest";
import { createMarqueeTool, type MarqueeablePrimitive } from "./marquee";
import { makeDom, makeEnv } from "./test-fixture";
import { DRAWING_KINDS, type DrawingKind } from "../model";
import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";

const STYLE = { width: 1, color: "#fff", pattern: "solid" as const, opacity: 1 };

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
});

function fakePrimitives(enclosed: number[]): Record<DrawingKind, MarqueeablePrimitive> {
  return Object.fromEntries(
    DRAWING_KINDS.map((k) => [
      k,
      { selectedId: null, setMarqueeIds: vi.fn(), getEnclosedIds: () => (k === "hline" ? enclosed : []) },
    ]),
  ) as unknown as Record<DrawingKind, MarqueeablePrimitive>;
}

function mount(enclosed: number[]) {
  const { container, fire } = makeDom();
  (container as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 900, height: 400 }) as DOMRect;
  const chart = { applyOptions: vi.fn(), timeScale: () => ({ width: () => 800, coordinateToLogical: () => null }) };
  const ctx = { chart, series: { priceToCoordinate: () => null, coordinateToPrice: () => null }, container } as unknown as ChartPluginContext;
  const tool = createMarqueeTool(env, fakePrimitives(enclosed));
  tool.plugin.onMount!(ctx);
  return { tool, fire };
}

const down = (x: number, y: number, ctrlKey = true) =>
  ({ clientX: x, clientY: y, button: 0, ctrlKey, metaKey: false, defaultPrevented: false, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() });

describe("marquee tool", () => {
  test("Ctrl+drag selects enclosed drawings and notifies", () => {
    const id = env.drawings.generateId();
    env.drawings.add("hline", { id, price: 1, time: 1, style: { ...STYLE } });
    const { tool, fire } = mount([id]);
    const changed = vi.fn();
    tool.onChange(changed);
    fire("container", "mousedown", down(10, 10));
    fire("window", "mouseup", down(200, 200));
    expect([...tool.selection().hline]).toEqual([id]);
    expect(changed).toHaveBeenCalled();
  });

  test("copy then paste adds offset clones as one undo step and selects them", () => {
    const id = env.drawings.generateId();
    env.drawings.add("hline", { id, price: 1, time: 1, style: { ...STYLE } });
    const { tool, fire } = mount([id]);
    fire("container", "mousedown", down(10, 10));
    fire("window", "mouseup", down(200, 200));
    expect(tool.copy()).toBe(true);
    expect(tool.paste()).toBe(true);
    expect(env.drawings.items("hline")).toHaveLength(2);
    expect(tool.selection().hline.size).toBe(1);
    env.drawings.undo();
    expect(env.drawings.items("hline")).toHaveLength(1);
  });

  test("deleteSelection removes the selection as one step", () => {
    const id1 = env.drawings.generateId();
    const id2 = env.drawings.generateId();
    env.drawings.add("hline", { id: id1, price: 1, time: 1, style: { ...STYLE } });
    env.drawings.add("hline", { id: id2, price: 2, time: 2, style: { ...STYLE } });
    const { tool, fire } = mount([id1, id2]);
    fire("container", "mousedown", down(10, 10));
    fire("window", "mouseup", down(200, 200));
    expect(tool.deleteSelection()).toBe(true);
    expect(env.drawings.items("hline")).toHaveLength(0);
    env.drawings.undo();
    expect(env.drawings.items("hline")).toHaveLength(2);
  });

  test("keys are ignored when this manager doesn't own the keyboard", () => {
    const id = env.drawings.generateId();
    env.drawings.add("hline", { id, price: 1, time: 1, style: { ...STYLE } });
    env = { ...env, keysActive: () => false };
    const { fire } = mount([id]);
    fire("container", "mousedown", down(10, 10));
    fire("window", "mouseup", down(200, 200));
    fire("document", "keydown", { key: "Delete", ctrlKey: false, metaKey: false, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() });
    expect(env.drawings.items("hline")).toHaveLength(1);
  });
});
