import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  PrimitiveHoveredItem,
  PrimitivePaneViewZOrder,
} from "lightweight-charts";
import { SelectableDrawingPrimitive } from "./DrawingPrimitiveBase";
import { crispRect, drawSelectionDot, lineBitmapWidth } from "./chart-drawing";
import { projectPoint } from "../lib/chart-measure";
import { bboxFromCorners, boxEdgeDistances, pointInBox, withinPointTolerance } from "../lib/drawing-geometry";
import { bboxFullyInside, type PixelRect } from "../lib/marquee-select";
import type { BoxData, BoxStyle } from "../model";

type BoxViewEntry = {
  id: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  style: BoxStyle;
};

type ViewData = {
  boxes: BoxViewEntry[];
  selectedId: number | null;
  hoveredId: number | null;
  marqueeIds: ReadonlySet<number>;
  previewBox: { left: number; top: number; right: number; bottom: number; style: BoxStyle } | null;
};

const CORNER_HIT_TOLERANCE = 8;
const EDGE_HIT_TOLERANCE = 6;

export type CornerIndex = "p1" | "p2" | "p1price-p2time" | "p2price-p1time";
export type EdgeIndex = "left" | "right" | "top" | "bottom";

class BoxToolRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly viewData: ViewData) {}

  draw(target: CanvasRenderingTarget2D) {
    const { boxes, selectedId, hoveredId, marqueeIds, previewBox } = this.viewData;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      for (const box of boxes) {
        const isSelected = box.id === selectedId || marqueeIds.has(box.id);
        const { borderColor, borderWidth, borderOpacity, bgColor, bgOpacity } = box.style;
        const strokeBm = lineBitmapWidth(borderWidth, hr);
        const rect = crispRect(box.left * hr, box.top * vr, box.right * hr, box.bottom * vr, strokeBm);
        const l = rect.left;
        const t = rect.top;
        const w = rect.right - rect.left;
        const h = rect.bottom - rect.top;

        // Background fill
        ctx.globalAlpha = bgOpacity;
        ctx.fillStyle = bgColor;
        ctx.fillRect(l, t, w, h);

        // Border
        ctx.globalAlpha = borderOpacity;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = strokeBm;
        ctx.strokeRect(l, t, w, h);
        ctx.globalAlpha = 1;

        if (isSelected || box.id === hoveredId) {
          const midX = l + w / 2;
          const midY = t + h / 2;
          const points = [
            // Corners
            [l, t], [l + w, t], [l, t + h], [l + w, t + h],
            // Edge midpoints
            [midX, t], [midX, t + h], [l, midY], [l + w, midY],
          ];
          for (const [cx, cy] of points) {
            drawSelectionDot(ctx, cx, cy, hr);
          }
        }
      }

      // Preview box while placing — uses the same style as final
      if (previewBox) {
        const { style: s } = previewBox;
        const strokeBm = lineBitmapWidth(s.borderWidth, hr);
        const rect = crispRect(previewBox.left * hr, previewBox.top * vr, previewBox.right * hr, previewBox.bottom * vr, strokeBm);
        const l = rect.left;
        const t = rect.top;
        const w = rect.right - rect.left;
        const h = rect.bottom - rect.top;

        ctx.globalAlpha = s.bgOpacity;
        ctx.fillStyle = s.bgColor;
        ctx.fillRect(l, t, w, h);
        ctx.globalAlpha = s.borderOpacity;
        ctx.strokeStyle = s.borderColor;
        ctx.lineWidth = strokeBm;
        ctx.strokeRect(l, t, w, h);
        ctx.globalAlpha = 1;
      }
    });
  }

  drawBackground() {}
}

class BoxToolPaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = {
    boxes: [],
    selectedId: null,
    hoveredId: null,
    marqueeIds: new Set(),
    previewBox: null,
  };

  constructor(private readonly source: BoxToolPrimitive) {}

  update() {
    const { boxes, selectedId, hoveredId, marqueeIds, previewCoords, chart, series } = this.source;

    this.viewData.previewBox = previewCoords;

    if (!chart || !series) {
      this.viewData.boxes = [];
      return;
    }

    const entries: BoxViewEntry[] = [];
    for (const box of boxes) {
      const p1 = projectPoint(chart, series, box.p1);
      const p2 = projectPoint(chart, series, box.p2);
      if (p1 == null || p2 == null) continue;

      entries.push({
        id: box.id,
        left: Math.min(p1.x, p2.x),
        top: Math.min(p1.y, p2.y),
        right: Math.max(p1.x, p2.x),
        bottom: Math.max(p1.y, p2.y),
        style: box.style,
      });
    }

    this.viewData.boxes = entries;
    this.viewData.selectedId = selectedId;
    this.viewData.hoveredId = hoveredId;
    this.viewData.marqueeIds = marqueeIds;
  }

  renderer() {
    return new BoxToolRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return this.source.dragging ? "top" : "normal";
  }
}

export class BoxToolPrimitive extends SelectableDrawingPrimitive<BoxToolPaneView, BoxData> {
  protected readonly paneViewsInstance: BoxToolPaneView[];

  boxes: BoxData[] = [];
  previewCoords: { left: number; top: number; right: number; bottom: number; style: BoxStyle } | null = null;

  constructor() {
    super();
    this.paneViewsInstance = [new BoxToolPaneView(this)];
  }

  protected override resetState() {
    this.previewCoords = null;
  }

  setData(boxes: BoxData[]) {
    this.boxes = boxes;
    this.refresh();
  }

  /** Box ids whose full bounding box lies inside the marquee rect (fully enclosed). */
  getEnclosedIds(rect: PixelRect): number[] {
    if (!this.chart || !this.series) return [];
    const ids: number[] = [];
    for (const box of this.boxes) {
      const p1 = projectPoint(this.chart, this.series, box.p1);
      const p2 = projectPoint(this.chart, this.series, box.p2);
      if (p1 == null || p2 == null) continue;
      const left = Math.min(p1.x, p2.x);
      const right = Math.max(p1.x, p2.x);
      const top = Math.min(p1.y, p2.y);
      const bottom = Math.max(p1.y, p2.y);
      if (bboxFullyInside(left, top, right, bottom, rect)) ids.push(box.id);
    }
    return ids;
  }

  setPreview(coords: { left: number; top: number; right: number; bottom: number; style: BoxStyle } | null) {
    this.previewCoords = coords;
    this.refresh();
  }

  /** Hit-test for a corner. Returns closest matching corner across all boxes. */
  cornerHitTest(x: number, y: number): { boxId: number; corner: CornerIndex } | null {
    if (!this.chart || !this.series) return null;
    let best: { boxId: number; corner: CornerIndex; dist: number } | null = null;
    for (const box of this.boxes) {
      const p1 = projectPoint(this.chart, this.series, box.p1);
      const p2 = projectPoint(this.chart, this.series, box.p2);
      if (p1 == null || p2 == null) continue;

      const corners: [number, number, CornerIndex][] = [
        [p1.x, p1.y, "p1"],
        [p2.x, p2.y, "p2"],
        [p1.x, p2.y, "p1price-p2time"],
        [p2.x, p1.y, "p2price-p1time"],
      ];

      for (const [cx, cy, corner] of corners) {
        const dist = Math.hypot(x - cx, y - cy);
        if (
          withinPointTolerance(x, y, cx, cy, CORNER_HIT_TOLERANCE) &&
          (best === null || dist < best.dist)
        ) {
          best = { boxId: box.id, corner, dist };
        }
      }
    }
    return best ? { boxId: best.boxId, corner: best.corner } : null;
  }

  /** Hit-test for an edge. Returns closest matching edge across all boxes. */
  edgeHitTest(x: number, y: number): { boxId: number; edge: EdgeIndex } | null {
    if (!this.chart || !this.series) return null;
    let best: { boxId: number; edge: EdgeIndex; dist: number } | null = null;
    for (const box of this.boxes) {
      const p1 = projectPoint(this.chart, this.series, box.p1);
      const p2 = projectPoint(this.chart, this.series, box.p2);
      if (p1 == null || p2 == null) continue;

      const bbox = bboxFromCorners(p1.x, p1.y, p2.x, p2.y);
      const tol = EDGE_HIT_TOLERANCE;

      for (const { edge, dist } of boxEdgeDistances(x, y, bbox, tol)) {
        if (dist <= tol && (best === null || dist < best.dist)) {
          best = { boxId: box.id, edge, dist };
        }
      }
    }
    return best ? { boxId: best.boxId, edge: best.edge } : null;
  }

  /** Hit-test for the box interior. Returns box id or null. */
  boxHitTest(x: number, y: number): number | null {
    if (!this.chart || !this.series) return null;
    let bestId: number | null = null;
    for (const box of this.boxes) {
      const p1 = projectPoint(this.chart, this.series, box.p1);
      const p2 = projectPoint(this.chart, this.series, box.p2);
      if (p1 == null || p2 == null) continue;

      const bbox = bboxFromCorners(p1.x, p1.y, p2.x, p2.y);
      if (pointInBox(x, y, bbox, EDGE_HIT_TOLERANCE)) {
        if (bestId === null || box.id > bestId) bestId = box.id;
      }
    }
    return bestId;
  }

  protected items() {
    return this.boxes;
  }

  protected anchorPrice(item: BoxData): number | null {
    return Math.max(item.p1.price, item.p2.price);
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    // Corner → move cursor
    const corner = this.cornerHitTest(x, y);
    if (corner) return { cursorStyle: "move", externalId: `box-corner:${corner.boxId}`, zOrder: "normal" };

    // Edge → directional resize cursor
    const edge = this.edgeHitTest(x, y);
    if (edge) {
      const cursor = edge.edge === "left" || edge.edge === "right" ? "ew-resize" : "ns-resize";
      return { cursorStyle: cursor, externalId: `box-edge:${edge.boxId}`, zOrder: "normal" };
    }

    return null;
  }
}
