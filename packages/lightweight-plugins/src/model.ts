import type { DrawingStyle } from "./lib/drawing-style";
import type { FibLevel } from "./lib/fib-levels";
import type { RayData } from "./primitives/HorizontalRayPrimitive";
import type { PathData } from "./primitives/PathToolPrimitive";
import type { FreeStrokeData } from "./primitives/FreeDrawPrimitive";
import type { TrendData } from "./primitives/TrendLinePrimitive";
import type { HLineData } from "./primitives/HorizontalLinePrimitive";
import type { VLineData } from "./primitives/VerticalLinePrimitive";

export type BoxStyle = {
  borderColor: string;
  borderWidth: number;
  borderOpacity: number;
  bgColor: string;
  bgOpacity: number;
};

export const DEFAULT_BOX_STYLE: BoxStyle = {
  borderColor: "#ffffff",
  borderWidth: 1,
  borderOpacity: 1,
  bgColor: "#2962ff",
  bgOpacity: 0.1,
};

export type BoxData = {
  id: number;
  p1: { price: number; time: number };
  p2: { price: number; time: number };
  style: BoxStyle;
};

export type FibData = {
  id: number;
  p1: { price: number; time: number };
  p2: { price: number; time: number };
  style: DrawingStyle;
  /** Per-drawing level override. Unset draws DEFAULT_FIB_LEVELS. */
  levels?: FibLevel[];
};

export type DrawingKind = "box" | "path" | "freedraw" | "fib" | "ray" | "trend" | "hline" | "vline";

export const DRAWING_KINDS = ["box", "path", "freedraw", "fib", "ray", "trend", "hline", "vline"] as const;

export type DrawingDataMap = {
  box: BoxData;
  path: PathData;
  freedraw: FreeStrokeData;
  fib: FibData;
  ray: RayData;
  trend: TrendData;
  hline: HLineData;
  vline: VLineData;
};

export type DrawingsBucket = { [K in DrawingKind]: DrawingDataMap[K][] };

export const emptyBucket = (): DrawingsBucket =>
  Object.fromEntries(DRAWING_KINDS.map((k) => [k, []])) as unknown as DrawingsBucket;
