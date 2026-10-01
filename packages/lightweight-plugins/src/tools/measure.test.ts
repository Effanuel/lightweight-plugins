import { beforeEach, describe, expect, test, vi } from "vitest";
import { createMeasureTool } from "./measure";
import { makeDom, makeEnv, mouse } from "./test-fixture";
import { registerChartEnv } from "../lib/chart-measure";
import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
});

function mount() {
  const { container, fire } = makeDom();
  (container as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 900, height: 400 }) as DOMRect;
  const chart = {
    applyOptions: vi.fn(),
    timeScale: () => ({ width: () => 800, coordinateToLogical: (x: number) => x, timeToCoordinate: (t: number) => t / 10 }),
  };
  registerChartEnv(chart as never, { getBars: () => [{ time: 0 }, { time: 10 }], tickSize: () => 0.01 });
  const ctx = { chart, series: { priceToCoordinate: (p: number) => p, coordinateToPrice: (c: number) => c }, container } as unknown as ChartPluginContext;
  const plugin = createMeasureTool(env);
  const teardown = plugin.onMount!(ctx);
  const primitive = plugin.primitives()[0] as unknown as { measurement: unknown };
  return { plugin, ctx, fire, teardown, primitive, chart };
}

describe("measure tool", () => {
  test("two clicks measure and disarm; nothing is stored", () => {
    const { fire, primitive } = mount();
    env.tools.setActiveTool("measure");
    fire("container", "mousedown", mouse(10, 100));
    fire("container", "mousedown", mouse(50, 80));
    expect(primitive.measurement).toBeTruthy();
    expect(env.tools.activeTool).toBeNull();
    expect(Object.values(env.drawings.getState().bucket).every((items) => items.length === 0)).toBe(true);
  });

  test("the next chart click after finishing is swallowed, the one after clears", () => {
    const { plugin, ctx, fire, primitive } = mount();
    env.tools.setActiveTool("measure");
    fire("container", "mousedown", mouse(10, 100));
    fire("container", "mousedown", mouse(50, 80));
    expect(plugin.onChartClick!({} as never, ctx)).toBe("consumed");
    expect(primitive.measurement).toBeTruthy();
    expect(plugin.onChartClick!({} as never, ctx)).toBe("consumed");
    expect(primitive.measurement).toBeFalsy();
    expect(plugin.onChartClick!({} as never, ctx)).toBe("pass");
  });

  test("Escape cancels and disarms", () => {
    const { fire } = mount();
    env.tools.setActiveTool("measure");
    fire("container", "mousedown", mouse(10, 100));
    fire("document", "keydown", { key: "Escape" });
    expect(env.tools.activeTool).toBeNull();
  });

  test("switching tool after the first click releases the scroll lock and clears the pending measurement", () => {
    const { fire, primitive } = mount();
    env.tools.setActiveTool("measure");
    fire("container", "mousedown", mouse(10, 100));
    expect(env.lockScroll).toHaveBeenLastCalledWith(true);
    env.tools.setActiveTool("trend");
    expect(env.lockScroll).toHaveBeenLastCalledWith(false);
    expect(primitive.measurement).toBeFalsy();
  });

  test("a mousedown below the pane (over the time axis) starts no measurement", () => {
    const { fire, primitive } = mount();
    env.tools.setActiveTool("measure");
    fire("container", "mousedown", mouse(10, 450)); // the pane is 400 tall
    expect(env.lockScroll).not.toHaveBeenCalled();
    fire("container", "mousedown", mouse(50, 80)); // so this is the first point, not the second
    expect(primitive.measurement).toBeFalsy();
    expect(env.tools.activeTool).toBe("measure");
  });

  test("measured prices snap to the tick size", () => {
    const { fire, primitive } = mount();
    env.tools.setActiveTool("measure");
    fire("container", "mousedown", mouse(10, 100.004));
    fire("container", "mousedown", mouse(50, 80.006));
    const m = primitive.measurement as { start: { price: number }; end: { price: number } };
    expect([m.start.price, m.end.price]).toEqual([100, 80.01]);
  });

  test("a finished measurement survives the automatic disarm", () => {
    const { fire, primitive } = mount();
    env.tools.setActiveTool("measure");
    fire("container", "mousedown", mouse(10, 100));
    fire("container", "mousedown", mouse(50, 80));
    expect(primitive.measurement).toBeTruthy();
  });
});
