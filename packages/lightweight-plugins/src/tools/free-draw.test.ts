import { describe, test, expect, beforeEach } from "vitest";
import { FreeDrawPrimitive } from "../primitives/FreeDrawPrimitive";
import { freeDrawConfig } from "./free-draw";
import { makeEnv, mountTool, mouse } from "./test-fixture";
import type { ToolEnv } from "../harness/chart-plugin";

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
  env.tools.setActiveTool("free-draw");
});

function mount() {
  return mountTool(freeDrawConfig(new FreeDrawPrimitive(), env));
}

describe("free-draw creation", () => {
  test("down -> move -> move -> up accumulates one freedraw with the sampled points", () => {
    const { fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 10));
    fire("container", "mousemove", mouse(30, 30));
    fire("container", "mousemove", mouse(60, 60));
    fire("window", "mouseup", mouse(60, 60));

    const strokes = env.drawings.items("freedraw");
    expect(strokes).toHaveLength(1);
    expect(strokes[0].points.length).toBe(3);
    teardown();
  });

  test("a click with no movement stores nothing (needs >= 2 points)", () => {
    const { fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 10));
    fire("window", "mouseup", mouse(10, 10));
    expect(env.drawings.items("freedraw")).toHaveLength(0);
    teardown();
  });
});

