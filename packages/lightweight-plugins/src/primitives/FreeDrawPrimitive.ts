import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  PrimitivePaneViewZOrder,
} from "lightweight-charts";
import { SelectableDrawingPrimitive } from "./DrawingPrimitiveBase";
import { drawSelectionDot, lineBitmapWidth } from "./chart-drawing";
import { dashPattern, DEFAULT_DRAWING_STYLE, type DrawingStyle } from "../lib/drawing-style";
import { projectPoint, projectPoints } from "../lib/chart-measure";
import { withinPolyline } from "../lib/drawing-geometry";
import { pointInRect, type PixelRect } from "../lib/marquee-select";

/** A single point of a freehand stroke, in chart (price, time) space. */
export type FreePoint = {
  price: number;
  time: number;
};

/**
 * A freehand stroke: a dense polyline captured while the pointer is held.
 * Unlike a Path, it has no per-vertex handles — it's rendered as one smooth
 * continuous line, with selection handles only at the two endpoints.
 */
export type FreeStrokeData = {
  id: number;
  points: FreePoint[];
  style: DrawingStyle;
};

type PointXY = { x: number; y: number };

type StrokeViewEntry = {
  id: number;
  coords: PointXY[];
  style: DrawingStyle;
};

type ViewData = {
  strokes: StrokeViewEntry[];
  selectedId: number | null;
  hoveredId: number | null;
  marqueeIds: ReadonlySet<number>;
  buildingCoords: PointXY[];
  buildingColor: string;
  buildingWidth: number;
};

const HIT_TOLERANCE = 6;

/**
 * Trace a smooth freehand curve through `coords` into the current path.
 * Each sampled point is used as a quadratic control point and the curve passes
 * through the midpoints between consecutive samples, which rounds off the
 * angular joints a plain moveTo/lineTo polyline produces. Coordinates are
 * scaled to bitmap space by (hr, vr) here.
 */
function traceSmooth(ctx: CanvasRenderingContext2D, coords: PointXY[], hr: number, vr: number) {
  if (coords.length === 0) return;
  ctx.moveTo(coords[0].x * hr, coords[0].y * vr);
  if (coords.length < 3) {
    for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x * hr, coords[i].y * vr);
    return;
  }
  for (let i = 1; i < coords.length - 1; i++) {
    const cx = coords[i].x * hr;
    const cy = coords[i].y * vr;
    const midX = (cx + coords[i + 1].x * hr) / 2;
    const midY = (cy + coords[i + 1].y * vr) / 2;
    ctx.quadraticCurveTo(cx, cy, midX, midY);
  }
  const last = coords[coords.length - 1];
  ctx.lineTo(last.x * hr, last.y * vr);
}

class FreeDrawRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly viewData: ViewData) {}

  draw(target: CanvasRenderingTarget2D) {
    const { strokes, selectedId, hoveredId, marqueeIds, buildingCoords, buildingColor, buildingWidth } = this.viewData;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      for (const stroke of strokes) {
        if (stroke.coords.length < 2) continue;
        const { color, width, pattern, opacity } = stroke.style;
        const strokeBm = lineBitmapWidth(width, hr);
        ctx.globalAlpha = opacity ?? 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeBm;
        ctx.setLineDash(dashPattern(pattern, strokeBm));
        ctx.beginPath();
        traceSmooth(ctx, stroke.coords, hr, vr);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Handles at the endpoints only — never one per vertex.
        if (stroke.id === selectedId || marqueeIds.has(stroke.id) || stroke.id === hoveredId) {
          const first = stroke.coords[0];
          const last = stroke.coords[stroke.coords.length - 1];
          drawSelectionDot(ctx, first.x * hr, first.y * vr, hr);
          drawSelectionDot(ctx, last.x * hr, last.y * vr, hr);
        }
      }

      // In-progress stroke.
      if (buildingCoords.length > 0) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = buildingColor;
        ctx.lineWidth = buildingWidth * hr;
        ctx.setLineDash([]);
        ctx.beginPath();
        traceSmooth(ctx, buildingCoords, hr, vr);
        ctx.stroke();
      }
    });
  }

  drawBackground() {}
}

class FreeDrawPaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = {
    strokes: [],
    selectedId: null,
    hoveredId: null,
    marqueeIds: new Set(),
    buildingCoords: [],
    buildingColor: DEFAULT_DRAWING_STYLE.color,
    buildingWidth: DEFAULT_DRAWING_STYLE.width,
  };

  constructor(private readonly source: FreeDrawPrimitive) {}

  update() {
    const { strokes, selectedId, hoveredId, marqueeIds, buildingPoints, buildingColor, buildingWidth, chart, series } =
      this.source;
    this.viewData.buildingColor = buildingColor;
    this.viewData.buildingWidth = buildingWidth;

    if (!chart || !series) {
      this.viewData.strokes = [];
      this.viewData.buildingCoords = [];
      return;
    }

    const entries: StrokeViewEntry[] = [];
    for (const stroke of strokes) {
      const coords = projectPoints(chart, series, stroke.points) ?? [];
      if (coords.length >= 2) {
        entries.push({ id: stroke.id, coords, style: stroke.style });
      }
    }
    this.viewData.strokes = entries;
    this.viewData.selectedId = selectedId;
    this.viewData.hoveredId = hoveredId;
    this.viewData.marqueeIds = marqueeIds;
    this.viewData.buildingCoords = projectPoints(chart, series, buildingPoints) ?? [];
  }

  renderer() {
    return new FreeDrawRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return this.source.dragging ? "top" : "normal";
  }
}

export class FreeDrawPrimitive extends SelectableDrawingPrimitive<FreeDrawPaneView, FreeStrokeData> {
  protected readonly paneViewsInstance: FreeDrawPaneView[];

  strokes: FreeStrokeData[] = [];
  buildingPoints: FreePoint[] = [];
  buildingColor: string = DEFAULT_DRAWING_STYLE.color;
  buildingWidth: number = DEFAULT_DRAWING_STYLE.width;

  constructor() {
    super();
    this.paneViewsInstance = [new FreeDrawPaneView(this)];
  }

  protected override resetState() {
    this.buildingPoints = [];
  }

  /** Sync finalized strokes from the store. */
  setData(strokes: FreeStrokeData[]) {
    this.strokes = strokes;
    this.refresh();
  }

  addBuildingPoint(point: FreePoint) {
    this.buildingPoints = [...this.buildingPoints, point];
    this.refresh();
  }

  /** Finalize the in-progress stroke. Returns the stroke, or null if too short (< 2 points). */
  finalizeBuildingPoints(id: number, style: DrawingStyle): FreeStrokeData | null {
    if (this.buildingPoints.length < 2) {
      this.buildingPoints = [];
      this.refresh();
      return null;
    }
    const stroke: FreeStrokeData = { id, points: this.buildingPoints, style };
    this.buildingPoints = [];
    this.refresh();
    return stroke;
  }

  cancelBuilding() {
    this.buildingPoints = [];
    this.refresh();
  }

  /** Stroke ids with at least one point inside the marquee rect. */
  getEnclosedIds(rect: PixelRect): number[] {
    if (!this.chart || !this.series) return [];
    const ids: number[] = [];
    for (const stroke of this.strokes) {
      for (const pt of stroke.points) {
        const projected = projectPoint(this.chart, this.series, pt);
        if (projected != null && pointInRect(projected.x, projected.y, rect)) {
          ids.push(stroke.id);
          break;
        }
      }
    }
    return ids;
  }

  strokeHitTest(x: number, y: number): number | null {
    if (!this.chart || !this.series) return null;
    let bestId: number | null = null;
    for (const stroke of this.strokes) {
      const coords = projectPoints(this.chart, this.series, stroke.points) ?? [];
      if (withinPolyline(x, y, coords, HIT_TOLERANCE)) {
        if (bestId === null || stroke.id > bestId) bestId = stroke.id;
      }
    }
    return bestId;
  }

  protected items() {
    return this.strokes;
  }

  protected anchorPrice(item: FreeStrokeData): number | null {
    return item.points[0]?.price ?? null;
  }
}
