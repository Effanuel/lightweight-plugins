import type { BoxData, FibData, DrawingKind, DrawingDataMap } from "../model";
import type { PathData } from "../primitives/PathToolPrimitive";
import type { FreeStrokeData } from "../primitives/FreeDrawPrimitive";
import type { RayData } from "../primitives/HorizontalRayPrimitive";
import type { TrendData } from "../primitives/TrendLinePrimitive";
import type { HLineData } from "../primitives/HorizontalLinePrimitive";
import type { VLineData } from "../primitives/VerticalLinePrimitive";
import type { ChartPluginContext } from "../harness/chart-plugin";
import { priceAtY, timeAtX } from "./chart-measure";

export type DrawingOffset = { priceDelta: number; timeDelta: number };

/** A positional copy in place (used by Alt+drag, which then drags the clone). */
export const NO_OFFSET: DrawingOffset = Object.freeze({ priceDelta: 0, timeDelta: 0 });

type Anchor = { price: number; time: number };

function shift(p: Anchor, o: DrawingOffset): Anchor {
  return { price: p.price + o.priceDelta, time: p.time + o.timeDelta };
}

export function cloneBox(box: BoxData, newId: number, offset: DrawingOffset): BoxData {
  return { id: newId, p1: shift(box.p1, offset), p2: shift(box.p2, offset), style: { ...box.style } };
}

export function cloneFib(fib: FibData, newId: number, offset: DrawingOffset): FibData {
  return {
    id: newId,
    p1: shift(fib.p1, offset),
    p2: shift(fib.p2, offset),
    style: { ...fib.style },
    levels: fib.levels?.map((l) => ({ ...l })),
  };
}

export function clonePath(path: PathData, newId: number, offset: DrawingOffset): PathData {
  return {
    id: newId,
    points: path.points.map((pt) => shift(pt, offset)),
    hasArrow: path.hasArrow,
    style: { ...path.style },
  };
}

export function cloneFreeDraw(stroke: FreeStrokeData, newId: number, offset: DrawingOffset): FreeStrokeData {
  return {
    id: newId,
    points: stroke.points.map((pt) => shift(pt, offset)),
    style: { ...stroke.style },
  };
}

export function cloneRay(ray: RayData, newId: number, offset: DrawingOffset): RayData {
  return { id: newId, price: ray.price + offset.priceDelta, time: ray.time + offset.timeDelta, style: { ...ray.style } };
}

export function cloneTrend(trend: TrendData, newId: number, offset: DrawingOffset): TrendData {
  return { id: newId, p1: shift(trend.p1, offset), p2: shift(trend.p2, offset), style: { ...trend.style } };
}

export function cloneHLine(line: HLineData, newId: number, offset: DrawingOffset): HLineData {
  return { id: newId, price: line.price + offset.priceDelta, time: line.time + offset.timeDelta, style: { ...line.style } };
}

export function cloneVLine(line: VLineData, newId: number, offset: DrawingOffset): VLineData {
  return { id: newId, time: line.time + offset.timeDelta, price: line.price + offset.priceDelta, style: { ...line.style } };
}

/**
 * Offset for a pasted group: ~5% of the visible time span to the right and ~5%
 * of the visible price span down, so the copy lands clearly visible near the
 * original while preserving the group's relative layout.
 */
export function offsetFromVisibleRange(
  ctx: Pick<ChartPluginContext, "chart" | "series" | "container">,
): DrawingOffset {
  const { chart, series, container } = ctx;
  const width = chart.timeScale().width();
  const tLeft = timeAtX(chart, 0);
  const tRight = timeAtX(chart, width);
  // Falls back to zero when the chart has no data yet (avoids a paste failure on empty charts).
  const timeDelta = tLeft != null && tRight != null ? Math.abs(tRight - tLeft) * 0.05 : 0;

  const height = container.clientHeight;
  const top = priceAtY(series, 0);
  const bottom = priceAtY(series, height);
  const priceDelta = top != null && bottom != null ? -Math.abs(top - bottom) * 0.05 : 0;

  return { priceDelta, timeDelta };
}

export const CLONE_BY_KIND: {
  [K in DrawingKind]: (item: DrawingDataMap[K], newId: number, offset: DrawingOffset) => DrawingDataMap[K];
} = {
  box: cloneBox,
  path: clonePath,
  freedraw: cloneFreeDraw,
  fib: cloneFib,
  ray: cloneRay,
  trend: cloneTrend,
  hline: cloneHLine,
  vline: cloneVLine,
};
