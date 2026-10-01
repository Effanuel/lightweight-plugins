import { describe, test, expect, beforeEach } from "vitest";
import { BoxToolPrimitive } from "../primitives/BoxToolPrimitive";
import { boxConfig } from "./box";
import { makeEnv, mountTool, mouse } from "./test-fixture";
import type { ToolEnv } from "../harness/chart-plugin";

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
  env.tools.setActiveTool("box");
});

function mount() {
  const primitive = new BoxToolPrimitive();
  return { primitive, ...mountTool(boxConfig(primitive, env)) };
}

describe("box creation", () => {
  test("two clicks store the two corners as p1 and p2", () => {
    const { fire, teardown } = mount();

    fire("container", "mousedown", mouse(10, 20));
    expect(env.drawings.items("box")).toHaveLength(0);

    fire("container", "mousedown", mouse(40, 80));

    const boxes = env.drawings.items("box");
    expect(boxes).toHaveLength(1);
    expect(boxes[0].p1).toEqual({ price: 20.5, time: 100 });
    expect(boxes[0].p2).toEqual({ price: 80.5, time: 400 });
    teardown();
  });
});

describe("box corner drag", () => {
  test("dragging the p2 corner moves p2 and leaves p1 alone", () => {
    const { primitive, fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 20));
    fire("container", "mousedown", mouse(40, 80));

    const box = env.drawings.items("box")[0];
    primitive.setData([box]);
    primitive.setHovered(box.id);

    fire("container", "mousedown", mouse(40, 80));
    fire("document", "mousemove", mouse(60, 95));
    fire("window", "mouseup", mouse(60, 95));

    const after = env.drawings.items("box")[0];
    expect(after.p1).toEqual({ price: 20.5, time: 100 });
    expect(after.p2.time).toBe(600);
    teardown();
  });
});

describe("box alt-drag clone", () => {
  test("Alt+drag clones with a new id, leaves the original unchanged", () => {
    const { fire, teardown } = mountTool(boxConfig(new BoxToolPrimitive(), env));
    fire("container", "mousedown", mouse(10, 20));
    fire("container", "mousedown", mouse(40, 80)); // box (10,20)-(40,80)

    const original = env.drawings.items("box")[0];
    fire("container", "mousedown", mouse(25, 50, { altKey: true }));
    fire("window", "mouseup", mouse(25, 50));

    const items = env.drawings.items("box");
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(original);
    expect(items[1].id).not.toBe(original.id);
    teardown();
  });
});
