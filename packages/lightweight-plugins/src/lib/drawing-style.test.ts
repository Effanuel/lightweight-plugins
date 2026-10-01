import { describe, expect, it } from "vitest";
import { dashPattern, DASH_MULTIPLIERS } from "./drawing-style";

describe("dashPattern", () => {
  it("returns an empty pattern for solid", () => {
    expect(dashPattern("solid", 1)).toEqual([]);
    expect(dashPattern("solid", 8)).toEqual([]);
  });

  // lightweight-charts' setLineStyle (dist/lightweight-charts.development.mjs:76)
  // builds every pattern as a multiple of ctx.lineWidth. We follow the scaling
  // but not its equal on/off runs for "dashed": at 1px an equal-run dash is
  // indistinguishable from the dotted pattern.
  it("scales dash runs with the stroke width", () => {
    expect(dashPattern("dashed", 1)).toEqual([4, 2]);
    expect(dashPattern("dashed", 3)).toEqual([12, 6]);
    expect(dashPattern("dotted", 1)).toEqual([1, 1]);
    expect(dashPattern("dotted", 4)).toEqual([4, 4]);
  });

  it("draws dashed with a stroke longer than its gap so it never reads as dotted", () => {
    const [on, off] = dashPattern("dashed", 5);
    expect(on).toBeGreaterThan(off);
    expect(DASH_MULTIPLIERS.dashed[0] / DASH_MULTIPLIERS.dashed[1]).toBe(2);
  });

  it("keeps dotted square", () => {
    const [on, off] = dashPattern("dotted", 5);
    expect(on).toBe(off);
  });

  it("never emits a zero-length run for a sub-pixel stroke", () => {
    expect(dashPattern("dotted", 0.4)).toEqual([1, 1]);
  });
});
