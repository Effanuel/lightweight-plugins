import { describe, test, expect, beforeEach } from "vitest";
import { PathToolPrimitive } from "../primitives/PathToolPrimitive";
import { pathConfig } from "./path";
import { makeEnv, mountTool, mouse } from "./test-fixture";
import type { ToolEnv } from "../harness/chart-plugin";

let env: ToolEnv;
beforeEach(() => {
  env = makeEnv();
  env.tools.setActiveTool("path");
});

function mount() {
  const primitive = new PathToolPrimitive();
  return { primitive, ...mountTool(pathConfig(primitive, env)) };
}

describe("path creation", () => {
  test("clicks accumulate points; a repeat click on the last point finalizes", () => {
    const { fire, teardown } = mount();

    fire("container", "mousedown", mouse(10, 20));
    fire("container", "mousedown", mouse(40, 50));
    fire("container", "mousedown", mouse(70, 80));
    expect(env.drawings.items("path")).toHaveLength(0);

    // Repeat click at the last position closes the path.
    fire("container", "mousedown", mouse(70, 80));

    const paths = env.drawings.items("path");
    expect(paths).toHaveLength(1);
    expect(paths[0].points.length).toBeGreaterThanOrEqual(3);
    expect(env.tools.activeTool).toBeNull();
    teardown();
  });
});

