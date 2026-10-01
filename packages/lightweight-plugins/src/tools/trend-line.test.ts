import { describe, test, expect, beforeEach } from "vitest";
import { TrendLinePrimitive } from "../primitives/TrendLinePrimitive";
import { trendConfig } from "./trend-line";
import { makeEnv, mountTool, mouse } from "./test-fixture";
import type { ToolEnv } from "../harness/chart-plugin";

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
  env.tools.setActiveTool("trend");
});

function mount() {
  const primitive = new TrendLinePrimitive();
  return { primitive, ...mountTool(trendConfig(primitive, env)) };
}

describe("trend creation", () => {
  test("the first click anchors without storing; the second stores p1 and p2", () => {
    const { fire, teardown } = mount();

    fire("container", "mousedown", mouse(10, 20));
    expect(env.drawings.items("trend")).toHaveLength(0);

    fire("container", "mousedown", mouse(40, 80));

    const trends = env.drawings.items("trend");
    expect(trends).toHaveLength(1);
    expect(trends[0].p1).toEqual({ price: 20.5, time: 100 });
    expect(trends[0].p2).toEqual({ price: 80.5, time: 400 });
    expect(env.tools.activeTool).toBeNull();
    teardown();
  });
});

describe("trend endpoint drag", () => {
  test("dragging p2 moves only p2", () => {
    const { primitive, fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 20));
    fire("container", "mousedown", mouse(40, 80));

    const trend = env.drawings.items("trend")[0];
    primitive.setHovered(trend.id);

    // hitTest must report an endpoint hit; place the cursor on p2's pixel.
    fire("container", "mousedown", mouse(40, 80));
    fire("document", "mousemove", mouse(70, 90));
    fire("window", "mouseup", mouse(70, 90));

    const after = env.drawings.items("trend")[0];
    expect(after.p1).toEqual({ price: 20.5, time: 100 }); // untouched
    expect(after.p2.time).toBe(700);
    teardown();
  });
});

