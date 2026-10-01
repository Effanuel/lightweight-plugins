import { describe, it, expect } from "vitest";
import {
  distToSegment,
  pointDist,
  withinPointTolerance,
  withinPolyline,
  bboxFromCorners,
  pointInBox,
  boxEdgeDistances,
  withinHorizontalLine,
  withinVerticalLine,
  type Point,
} from "./drawing-geometry";

describe("distToSegment", () => {
  it("returns perpendicular distance to the segment body", () => {
    // Segment (0,0)→(10,0); point (5,3) → distance 3
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
  });

  it("clamps to the nearest endpoint when the projection falls outside", () => {
    // Point left of A → distance to A
    expect(distToSegment(-4, 0, 0, 0, 10, 0)).toBeCloseTo(4);
    // Point right of B → distance to B
    expect(distToSegment(13, 0, 0, 0, 10, 0)).toBeCloseTo(3);
  });

  it("handles a degenerate (zero-length) segment as a point distance", () => {
    expect(distToSegment(3, 4, 1, 1, 1, 1)).toBeCloseTo(Math.hypot(2, 3));
  });

  it("returns 0 for a point on the segment", () => {
    expect(distToSegment(5, 0, 0, 0, 10, 0)).toBe(0);
  });
});

describe("pointDist", () => {
  it("computes euclidean distance", () => {
    expect(pointDist(0, 0, 3, 4)).toBe(5);
  });
});

describe("withinPointTolerance", () => {
  it("is true at exactly the tolerance (inclusive)", () => {
    expect(withinPointTolerance(0, 0, 3, 4, 5)).toBe(true);
  });

  it("is false just beyond the tolerance", () => {
    expect(withinPointTolerance(0, 0, 3, 4, 4.99)).toBe(false);
  });
});

describe("withinPolyline", () => {
  const line: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];

  it("detects a near-segment hit on any segment", () => {
    expect(withinPolyline(5, 2, line, 3)).toBe(true); // near first segment
    expect(withinPolyline(12, 5, line, 3)).toBe(true); // near second segment
  });

  it("returns false when no segment is within tolerance", () => {
    expect(withinPolyline(5, 20, line, 3)).toBe(false);
  });

  it("returns false for fewer than two points", () => {
    expect(withinPolyline(0, 0, [{ x: 0, y: 0 }], 5)).toBe(false);
    expect(withinPolyline(0, 0, [], 5)).toBe(false);
  });

  it("is inclusive at exactly the tolerance", () => {
    expect(withinPolyline(5, 3, line, 3)).toBe(true);
  });
});

describe("bboxFromCorners", () => {
  it("normalizes regardless of corner order", () => {
    expect(bboxFromCorners(10, 20, 2, 5)).toEqual({ left: 2, top: 5, right: 10, bottom: 20 });
  });
});

describe("pointInBox", () => {
  const box = bboxFromCorners(0, 0, 10, 10);

  it("is true strictly inside and on the edge with pad 0", () => {
    expect(pointInBox(5, 5, box)).toBe(true);
    expect(pointInBox(0, 0, box)).toBe(true);
    expect(pointInBox(10, 10, box)).toBe(true);
  });

  it("is false just outside with pad 0", () => {
    expect(pointInBox(-1, 5, box)).toBe(false);
    expect(pointInBox(11, 5, box)).toBe(false);
  });

  it("expands the hit area by pad", () => {
    expect(pointInBox(-5, 5, box, 6)).toBe(true);
    expect(pointInBox(-7, 5, box, 6)).toBe(false);
  });
});

describe("boxEdgeDistances", () => {
  const box = bboxFromCorners(0, 0, 100, 50);

  it("returns left/right distances when inside the vertical band", () => {
    const edges = boxEdgeDistances(10, 25, box, 6);
    const byEdge = Object.fromEntries(edges.map((e) => [e.edge, e.dist]));
    expect(byEdge.left).toBe(10);
    expect(byEdge.right).toBe(90);
    expect(byEdge.top).toBe(25);
    expect(byEdge.bottom).toBe(25);
  });

  it("omits left/right when outside the vertical band beyond tolerance", () => {
    const edges = boxEdgeDistances(10, 100, box, 6);
    const names = edges.map((e) => e.edge);
    expect(names).not.toContain("left");
    expect(names).not.toContain("right");
  });

  it("omits top/bottom when outside the horizontal band beyond tolerance", () => {
    const edges = boxEdgeDistances(200, 25, box, 6);
    const names = edges.map((e) => e.edge);
    expect(names).not.toContain("top");
    expect(names).not.toContain("bottom");
  });

  it("includes an edge exactly at the band tolerance boundary", () => {
    // py = top - tolerance = -6 → still within band
    const edges = boxEdgeDistances(50, -6, box, 6);
    const names = edges.map((e) => e.edge);
    expect(names).toContain("left");
    expect(names).toContain("right");
  });
});

describe("withinHorizontalLine", () => {
  it("is true within tolerance and inclusive at the boundary", () => {
    expect(withinHorizontalLine(103, 100, 3)).toBe(true);
    expect(withinHorizontalLine(97, 100, 3)).toBe(true);
  });

  it("is false beyond tolerance", () => {
    expect(withinHorizontalLine(104, 100, 3)).toBe(false);
  });
});

describe("withinVerticalLine", () => {
  it("is true when the horizontal gap is within tolerance", () => {
    expect(withinVerticalLine(100, 102, 3)).toBe(true);
  });
  it("is true at exactly the tolerance boundary", () => {
    expect(withinVerticalLine(100, 103, 3)).toBe(true);
  });
  it("is false when the horizontal gap exceeds tolerance", () => {
    expect(withinVerticalLine(100, 110, 3)).toBe(false);
  });
  it("is true for a negative offset within tolerance", () => {
    expect(withinVerticalLine(103, 100, 3)).toBe(true);
  });
});
