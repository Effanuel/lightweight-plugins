import { describe, test, expect } from "vitest";
import { DEFAULT_FIB_LEVELS, visibleFibLevels, type FibLevel } from "./fib-levels";

describe("DEFAULT_FIB_LEVELS", () => {
  test("carries the historic six ratios, all visible", () => {
    expect(DEFAULT_FIB_LEVELS.map((l) => l.value)).toEqual([0, 1, 1.618, 2.618, 4.618, 8.618]);
    expect(DEFAULT_FIB_LEVELS.every((l) => l.visible)).toBe(true);
    expect(DEFAULT_FIB_LEVELS.every((l) => l.color === undefined)).toBe(true);
  });
});

describe("visibleFibLevels", () => {
  test("an unset override falls back to the defaults", () => {
    expect(visibleFibLevels(undefined)).toEqual(DEFAULT_FIB_LEVELS);
  });

  test("an override replaces the defaults", () => {
    const levels: FibLevel[] = [
      { value: 0.382, visible: true },
      { value: 0.618, visible: true, color: "#ff0000" },
    ];
    expect(visibleFibLevels(levels)).toEqual(levels);
  });

  test("hidden levels are dropped", () => {
    const levels: FibLevel[] = [
      { value: 0, visible: true },
      { value: 1, visible: false },
      { value: 1.618, visible: true },
    ];
    expect(visibleFibLevels(levels).map((l) => l.value)).toEqual([0, 1.618]);
  });

  test("an empty override draws nothing — it is not an unset override", () => {
    expect(visibleFibLevels([])).toEqual([]);
  });
});
