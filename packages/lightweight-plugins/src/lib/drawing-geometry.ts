/**
 * Pure pixel-space geometry for the drawing primitives' hit-tests and
 * enclosure tests.
 *
 * All coordinates are CSS pixels in the chart pane's space — the same space
 * returned by `projectPoint` / `getChartPaneCoords`. These functions take
 * already-projected pixel points so they carry no dependency on `chart` /
 * `series` and are unit-testable under jsdom without a canvas.
 */

export type Point = { x: number; y: number };

/** Shortest distance from point (px,py) to the line segment (ax,ay)→(bx,by). */
export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Euclidean distance between two points. */
export function pointDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}

/**
 * True when (px,py) is within `tolerance` (inclusive) of the point (cx,cy).
 * Used for corner / endpoint / vertex hit-testing.
 */
export function withinPointTolerance(
  px: number,
  py: number,
  cx: number,
  cy: number,
  tolerance: number,
): boolean {
  return pointDist(px, py, cx, cy) <= tolerance;
}

/**
 * True when (px,py) lies within `tolerance` (inclusive) of the polyline
 * described by `points` (any segment). Returns false for fewer than 2 points.
 */
export function withinPolyline(
  px: number,
  py: number,
  points: readonly Point[],
  tolerance: number,
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (distToSegment(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y) <= tolerance) {
      return true;
    }
  }
  return false;
}

/** Axis-aligned bounding box in pixel space. */
export type Bbox = { left: number; top: number; right: number; bottom: number };

/** Build a normalized bbox from two corner points (any order). */
export function bboxFromCorners(x1: number, y1: number, x2: number, y2: number): Bbox {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  };
}

/**
 * True when (px,py) is inside `box` expanded by `pad` on every side
 * (pad = 0 → strict containment on the box edges).
 */
export function pointInBox(px: number, py: number, box: Bbox, pad = 0): boolean {
  return px >= box.left - pad && px <= box.right + pad && py >= box.top - pad && py <= box.bottom + pad;
}

export type EdgeName = "left" | "right" | "top" | "bottom";

/**
 * Distances from (px,py) to each of a box's four edges, but only to edges the
 * point is "alongside" within `tolerance` (i.e. left/right only when the point
 * is within the vertical band, top/bottom only within the horizontal band).
 *
 * Mirrors BoxToolPrimitive.edgeHitTest's banding so a near-edge hit only
 * registers when the cursor is actually beside that edge.
 */
export function boxEdgeDistances(
  px: number,
  py: number,
  box: Bbox,
  tolerance: number,
): Array<{ edge: EdgeName; dist: number }> {
  const out: Array<{ edge: EdgeName; dist: number }> = [];
  if (py >= box.top - tolerance && py <= box.bottom + tolerance) {
    out.push({ edge: "left", dist: Math.abs(px - box.left) });
    out.push({ edge: "right", dist: Math.abs(px - box.right) });
  }
  if (px >= box.left - tolerance && px <= box.right + tolerance) {
    out.push({ edge: "top", dist: Math.abs(py - box.top) });
    out.push({ edge: "bottom", dist: Math.abs(py - box.bottom) });
  }
  return out;
}

/** True when the absolute vertical gap |py - lineY| is within tolerance. */
export function withinHorizontalLine(py: number, lineY: number, tolerance: number): boolean {
  return Math.abs(py - lineY) <= tolerance;
}

/** True when the absolute horizontal gap |px - lineX| is within tolerance. */
export function withinVerticalLine(px: number, lineX: number, tolerance: number): boolean {
  return Math.abs(px - lineX) <= tolerance;
}
