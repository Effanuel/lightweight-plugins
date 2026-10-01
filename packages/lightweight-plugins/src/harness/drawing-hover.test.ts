import { describe, expect, test } from "vitest";
import { createHoverArbiter } from "./drawing-hover";

const tick = () => new Promise<void>((r) => queueMicrotask(r));

describe("hover arbiter", () => {
  test("a corner hit beats a body hit with a higher id", async () => {
    const report = createHoverArbiter();
    const seen: Record<string, number | null> = {};
    report((id) => (seen.a = id), 1, "corner");
    report((id) => (seen.b = id), 9, "body");
    await tick();
    expect(seen).toEqual({ a: 1, b: null });
  });

  test("two arbiters never resolve each other's candidates", async () => {
    const one = createHoverArbiter();
    const two = createHoverArbiter();
    const seen: Record<string, number | null> = {};
    one((id) => (seen.a = id), 1, "body");
    two((id) => (seen.b = id), 2, "body");
    await tick();
    expect(seen).toEqual({ a: 1, b: 2 });
  });
});
