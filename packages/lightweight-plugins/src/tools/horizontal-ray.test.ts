import { describe, test, expect, beforeEach } from "vitest";
import { HorizontalRayPrimitive } from "../primitives/HorizontalRayPrimitive";
import { rayConfig } from "./horizontal-ray";
import { makeEnv, mountTool, mouse } from "./test-fixture";
import type { ToolEnv } from "../harness/chart-plugin";

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
  env.tools.setActiveTool("h-ray");
});

function mount() {
  const primitive = new HorizontalRayPrimitive();
  return { primitive, ...mountTool(rayConfig(primitive, env)) };
}

describe("h-ray creation", () => {
  test("one click stores a ray at the magnet price", () => {
    const { fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 20));

    const rays = env.drawings.items("ray");
    expect(rays).toHaveLength(1);
    expect(rays[0].price).toBe(20.5);
    expect(rays[0].time).toBe(100);
    teardown();
  });
});

describe("h-ray move drag", () => {
  test("dragging places the ray AT the magnet price, ignoring the grab gap", () => {
    const { primitive, fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 20));

    const id = env.drawings.items("ray")[0].id;
    primitive.setHovered(id);

    fire("container", "mousedown", mouse(10, 25)); // grabbed 5px below the line
    fire("document", "mousemove", mouse(30, 70));
    fire("window", "mouseup", mouse(30, 70));

    // 70.5, not 70.5 - 5: the ray snaps to the cursor's magnet price.
    expect(env.drawings.items("ray")[0].price).toBe(70.5);
    teardown();
  });
});

describe("ray alt-drag clone", () => {
  test("Alt+drag clones with a new id, leaves the original unchanged", () => {
    const { fire, teardown } = mountTool(rayConfig(new HorizontalRayPrimitive(), env));
    fire("container", "mousedown", mouse(10, 20)); // create at price 20.5, time 100

    const original = env.drawings.items("ray")[0];
    fire("container", "mousedown", mouse(10, 20, { altKey: true }));
    fire("window", "mouseup", mouse(10, 20));

    const items = env.drawings.items("ray");
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(original);
    expect(items[1].id).not.toBe(original.id);
    teardown();
  });
});
