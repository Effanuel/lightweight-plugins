import type { IChartApi, ISeriesPrimitive, MouseEventHandler, Time } from "lightweight-charts";
import type { PriceConverter } from "../lib/chart-measure";
import type { DrawingStore } from "../store/drawing-store";
import type { ToolState } from "../store/tool-state";
import type { ReportHover } from "./drawing-hover";

export type ChartPluginContext = {
  readonly chart: IChartApi;
  /** Price↔pixel only. */
  readonly series: PriceConverter;
  readonly container: HTMLDivElement;
  /** The pane element drawings live in, resolved per call. Null → callers fall back to the container. */
  readonly paneEl?: () => HTMLElement | null;
};

export type ClickResult = "consumed" | "pass";

export type Teardown = () => void;

export interface ChartPlugin {
  readonly name: string;
  readonly clickPriority?: number;
  primitives(): ReadonlyArray<ISeriesPrimitive<Time>>;
  onMount?(ctx: ChartPluginContext): Teardown;
  onChartClick?(param: Parameters<MouseEventHandler<Time>>[0], ctx: ChartPluginContext): ClickResult;
}

/** Everything a tool reads besides its chart: terminal's stores and pane state, per DrawingManager. */
export type ToolEnv = {
  readonly drawings: DrawingStore;
  readonly tools: ToolState;
  tickSize(): number;
  readonly reportHover: ReportHover;
  /** Whether this manager owns keyboard shortcuts right now (keyboard on, and its chart was clicked last). */
  keysActive(): boolean;
  /**
   * Locks chart scroll/scale during a gesture. Unlocking restores the chart's
   * own options from before the lock; unlocking while unlocked does nothing.
   */
  lockScroll(locked: boolean): void;
};
