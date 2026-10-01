import { describe, test, expect, beforeEach } from "vitest";
import { FibonacciPrimitive } from "../primitives/FibonacciPrimitive";
import { fibConfig } from "./fibonacci";
import { makeEnv, mountTool, mouse } from "./test-fixture";
import type { ToolEnv } from "../harness/chart-plugin";
import { DEFAULT_FIB_LEVELS, type FibLevel } from "../lib/fib-levels";

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
  env.tools.setActiveTool("fibonacci");
});

function mount() {
  const primitive = new FibonacciPrimitive();
  return { primitive, ...mountTool(fibConfig(primitive, env)) };
}

describe("fibonacci creation", () => {
  test("the first click anchors without storing; the second stores p1 and p2", () => {
    const { fire, teardown } = mount();

    fire("container", "mousedown", mouse(10, 20));
    expect(env.drawings.items("fib")).toHaveLength(0);

    fire("container", "mousedown", mouse(40, 80));

    const fibs = env.drawings.items("fib");
    expect(fibs).toHaveLength(1);
    expect(fibs[0].p1).toEqual({ price: 20.5, time: 100 });
    expect(fibs[0].p2).toEqual({ price: 80.5, time: 400 });
    teardown();
  });

  test("a new fib is stamped with the configured levels", () => {
    const levels: FibLevel[] = [
      { value: 0, visible: true },
      { value: 0.618, visible: false, color: "#ff0000" },
    ];
    Object.defineProperty(env.tools, "fibLevels", { value: levels }); // ToolState has no setter; a per-test override
    const { fire, teardown } = mount();

    fire("container", "mousedown", mouse(10, 20));
    fire("container", "mousedown", mouse(40, 80));

    expect(env.drawings.items("fib")[0].levels).toEqual(levels);
    teardown();
  });

  test("a fib drawn with the stock configuration carries the default levels", () => {
    const { fire, teardown } = mount();

    fire("container", "mousedown", mouse(10, 20));
    fire("container", "mousedown", mouse(40, 80));

    expect(env.drawings.items("fib")[0].levels).toEqual(DEFAULT_FIB_LEVELS);
    teardown();
  });

  test("an anchored tool stays armed until the second click lands", () => {
    const { fire, teardown } = mount();
    fire("container", "mousedown", mouse(10, 20));
    expect(env.tools.activeTool).toBe("fibonacci");
    teardown();
  });
});

describe("fib alt-drag clone", () => {
  test("Alt+drag clones with a new id, leaves the original unchanged, one undo step", () => {
    const { fire, teardown } = mountTool(fibConfig(new FibonacciPrimitive(), env));
    fire("container", "mousedown", mouse(10, 20));
    fire("container", "mousedown", mouse(40, 80)); // fib (10,20)-(40,80)

    const original = env.drawings.items("fib")[0];
    fire("container", "mousedown", mouse(25, 50, { altKey: true }));
    fire("window", "mouseup", mouse(25, 50));

    const items = env.drawings.items("fib");
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(original);
    expect(items[1].id).not.toBe(original.id);
    env.drawings.undo();
    expect(env.drawings.items("fib")).toHaveLength(1);
    teardown();
  });
});
