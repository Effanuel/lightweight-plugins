import { describe, test, expect, beforeEach } from "vitest";
import { VerticalLinePrimitive } from "../primitives/VerticalLinePrimitive";
import { vlineConfig } from "./vertical-line";
import { makeEnv, mountTool, mouse } from "./test-fixture";
import type { ToolEnv } from "../harness/chart-plugin";

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
  env.tools.setActiveTool("v-line");
});

function mount() {
  const primitive = new VerticalLinePrimitive();
  return { primitive, ...mountTool(vlineConfig(primitive, env)) };
}

describe("v-line creation", () => {
  test("one click stores a line at the RAW price, not the magnet price", () => {
    const { fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 20));

    const lines = env.drawings.items("vline");
    expect(lines).toHaveLength(1);
    expect(lines[0].price).toBe(20); // rawPrice, NOT 20.5
    expect(lines[0].time).toBe(100);
    teardown();
  });
});

describe("v-line move drag", () => {
  test("dragging preserves the grab time offset", () => {
    const { primitive, fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 20)); // time = 100

    const id = env.drawings.items("vline")[0].id;
    primitive.setHovered(id);

    // Grab at x=12 (time 120): offset = 100 - 120 = -20.
    fire("container", "mousedown", mouse(12, 20));
    fire("document", "mousemove", mouse(50, 40)); // time 500 + (-20) = 480
    fire("window", "mouseup", mouse(50, 40));

    const line = env.drawings.items("vline")[0];
    expect(line.time).toBe(480);
    expect(line.price).toBe(40); // rawPrice while dragging
    teardown();
  });
});

