import { describe, expect, test, vi } from "vitest";
import { ToolState } from "./tool-state";
import { DEFAULT_DRAWING_STYLE } from "../lib/drawing-style";
import { DEFAULT_BOX_STYLE } from "../model";
import { DEFAULT_FIB_LEVELS } from "../lib/fib-levels";

describe("ToolState", () => {
  test("starts with no tool and default styles", () => {
    const t = new ToolState();
    expect(t.activeTool).toBeNull();
    expect(t.getLastUsedStyle("trend")).toEqual(DEFAULT_DRAWING_STYLE);
    expect(t.getLastUsedBoxStyle()).toEqual(DEFAULT_BOX_STYLE);
    expect(t.fibLevels).toEqual(DEFAULT_FIB_LEVELS);
  });

  test("setActiveTool notifies on change only; clearTool disarms", () => {
    const t = new ToolState();
    const fn = vi.fn();
    t.subscribe(fn);
    t.setActiveTool("trend");
    t.setActiveTool("trend");
    t.clearTool();
    expect(fn.mock.calls).toEqual([["trend"], [null]]);
  });

  test("last-used styles merge per slot", () => {
    const t = new ToolState();
    t.setLastUsedStyle("trend", { color: "#f00" });
    t.setLastUsedBoxStyle({ bgOpacity: 0.5 });
    expect(t.getLastUsedStyle("trend")).toEqual({ ...DEFAULT_DRAWING_STYLE, color: "#f00" });
    expect(t.getLastUsedStyle("h-line")).toEqual(DEFAULT_DRAWING_STYLE);
    expect(t.getLastUsedBoxStyle()).toEqual({ ...DEFAULT_BOX_STYLE, bgOpacity: 0.5 });
  });
});
