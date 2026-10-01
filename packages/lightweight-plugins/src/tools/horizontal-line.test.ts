import { describe, test, expect, beforeEach } from "vitest";
import { HorizontalLinePrimitive } from "../primitives/HorizontalLinePrimitive";
import { hlineConfig } from "./horizontal-line";
import { makeEnv, mountTool, mouse } from "./test-fixture";
import type { ToolEnv } from "../harness/chart-plugin";

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
  env.tools.setActiveTool("h-line");
});

function mount() {
  const primitive = new HorizontalLinePrimitive();
  return { primitive, ...mountTool(hlineConfig(primitive, env)) };
}

describe("h-line creation", () => {
  test("one click stores a line at the magnet price and disarms the tool", () => {
    const { fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 20));

    const lines = env.drawings.items("hline");
    expect(lines).toHaveLength(1);
    expect(lines[0].price).toBe(20.5); // magnetPrice = y + 0.5
    expect(lines[0].time).toBe(100); // time = x * 10
    expect(env.tools.activeTool).toBeNull();
    teardown();
  });
});

describe("h-line move drag", () => {
  test("dragging a hovered line moves it to the magnet price under the cursor", () => {
    const { primitive, fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 20)); // create, disarms

    const id = env.drawings.items("hline")[0].id;
    primitive.setHovered(id); // hitTest arms off hoveredId

    fire("container", "mousedown", mouse(10, 20));
    fire("document", "mousemove", mouse(30, 60));
    fire("window", "mouseup", mouse(30, 60));

    expect(env.drawings.items("hline")[0].price).toBe(60.5);
    teardown();
  });
});
