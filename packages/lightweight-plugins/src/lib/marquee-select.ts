/**
 * Pure pixel-space geometry for the Ctrl+drag marquee multi-select.
 *
 * All coordinates are CSS pixels in the chart pane's space — the same space
 * returned by `getChartPaneCoords` and by the primitives' `priceToCoordinate`
 * / `timeToCoordinateOrNearest` conversions, so a marquee rect and a drawing's
 * projected points can be compared directly.
 */

export type PixelRect = { minX: number; minY: number; maxX: number; maxY: number };

/** Build a normalized rect from two drag corners (any order). */
export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): PixelRect {
  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2),
  };
}

/** True when (x, y) lies on or inside the rect. */
export function pointInRect(x: number, y: number, r: PixelRect): boolean {
  return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY;
}

/** True when the whole bounding box [left,right]×[top,bottom] is inside the rect. */
export function bboxFullyInside(
  left: number,
  top: number,
  right: number,
  bottom: number,
  r: PixelRect,
): boolean {
  return left >= r.minX && right <= r.maxX && top >= r.minY && bottom <= r.maxY;
}

/** Minimum drag extent (px) on both axes before a marquee counts as a gesture. */
const MARQUEE_MIN_SIZE = 3;

/** True when the rect is large enough to be an intentional selection (not a click). */
export function rectIsMeaningful(r: PixelRect): boolean {
  return r.maxX - r.minX >= MARQUEE_MIN_SIZE && r.maxY - r.minY >= MARQUEE_MIN_SIZE;
}
