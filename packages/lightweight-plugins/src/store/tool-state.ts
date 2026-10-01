import { DEFAULT_DRAWING_STYLE, type DrawingStyle } from "../lib/drawing-style";
import { DEFAULT_FIB_LEVELS, type FibLevel } from "../lib/fib-levels";
import { DEFAULT_BOX_STYLE, type BoxStyle } from "../model";

export type ToolName =
  | "select" | "h-line" | "h-ray" | "v-line" | "trend" | "box" | "fibonacci" | "path" | "free-draw" | "measure";

/** Last-used style slots. Free draw shares "path"'s slot, as in terminal; box has its own BoxStyle. */
export type StyleSlot = "h-line" | "h-ray" | "v-line" | "trend" | "fibonacci" | "path";

const STYLE_SLOTS: readonly StyleSlot[] = ["h-line", "h-ray", "v-line", "trend", "fibonacci", "path"];

/** The armed tool and the styles new drawings get: terminal's chart-tools store, unpersisted. */
export class ToolState {
  private tool: ToolName | null = null;
  private styles = Object.fromEntries(STYLE_SLOTS.map((s) => [s, { ...DEFAULT_DRAWING_STYLE }])) as Record<
    StyleSlot,
    DrawingStyle
  >;
  private boxStyle: BoxStyle = { ...DEFAULT_BOX_STYLE };
  readonly fibLevels: FibLevel[] = DEFAULT_FIB_LEVELS;
  private readonly listeners = new Set<(tool: ToolName | null) => void>();

  get activeTool(): ToolName | null {
    return this.tool;
  }

  setActiveTool(tool: ToolName | null): void {
    if (tool === this.tool) return;
    this.tool = tool;
    for (const listener of [...this.listeners]) listener(tool);
  }

  clearTool(): void {
    this.setActiveTool(null);
  }

  getLastUsedStyle(slot: StyleSlot): DrawingStyle {
    return this.styles[slot];
  }

  setLastUsedStyle(slot: StyleSlot, patch: Partial<DrawingStyle>): void {
    this.styles = { ...this.styles, [slot]: { ...this.styles[slot], ...patch } };
  }

  getLastUsedBoxStyle(): BoxStyle {
    return this.boxStyle;
  }

  setLastUsedBoxStyle(patch: Partial<BoxStyle>): void {
    this.boxStyle = { ...this.boxStyle, ...patch };
  }

  subscribe(listener: (tool: ToolName | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
