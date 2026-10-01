import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  PrimitivePaneViewZOrder,
} from "lightweight-charts";
import { SelectableDrawingPrimitive } from "./DrawingPrimitiveBase";
import { drawFilledCircle, drawSelectionDot, lineBitmapWidth } from "./chart-drawing";
import { dashPattern, DEFAULT_DRAWING_STYLE, type DrawingStyle } from "../lib/drawing-style";
import { projectPoint, projectPoints } from "../lib/chart-measure";
import { withinPointTolerance, withinPolyline } from "../lib/drawing-geometry";
import { pointInRect, type PixelRect } from "../lib/marquee-select";

export type PathPoint = {
  price: number;
  time: number;
};

export type PathData = {
  id: number;
  points: PathPoint[];
  hasArrow: boolean;
  style: DrawingStyle;
};

type PointXY = { x: number; y: number };

type PathViewEntry = {
  id: number;
  coords: PointXY[];
  hasArrow: boolean;
  style: DrawingStyle;
};

type ViewData = {
  paths: PathViewEntry[];
  selectedId: number | null;
  hoveredId: number | null;
  marqueeIds: ReadonlySet<number>;
  buildingCoords: PointXY[];
  previewEnd: PointXY | null;
  buildingColor: string;
};

const HIT_TOLERANCE = 6;
const CORNER_HIT_TOLERANCE = 8;
const ARROW_SIZE = 8;

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number,
  color: string,
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

class PathToolRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly viewData: ViewData) {}

  draw(target: CanvasRenderingTarget2D) {
    const { paths, selectedId, hoveredId, marqueeIds, buildingCoords, previewEnd, buildingColor } = this.viewData;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      for (const path of paths) {
        if (path.coords.length < 2) continue;
        const isSelected = path.id === selectedId || marqueeIds.has(path.id);
        const { color, width, pattern, opacity } = path.style;

        // Line always uses its own color
        const strokeBm = lineBitmapWidth(width, hr);
        ctx.globalAlpha = opacity ?? 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeBm;
        ctx.setLineDash(dashPattern(pattern, strokeBm));
        ctx.beginPath();
        ctx.moveTo(path.coords[0].x * hr, path.coords[0].y * vr);
        for (let i = 1; i < path.coords.length; i++) {
          ctx.lineTo(path.coords[i].x * hr, path.coords[i].y * vr);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        if (isSelected || path.id === hoveredId) {
          for (const pt of path.coords) {
            drawSelectionDot(ctx, pt.x * hr, pt.y * vr, hr);
          }
        }

        // Arrowhead uses line color
        if (path.hasArrow && path.coords.length >= 2) {
          const from = path.coords[path.coords.length - 2];
          const to = path.coords[path.coords.length - 1];
          const arrowSize = (ARROW_SIZE + width * 2) * hr;
          drawArrowhead(ctx, from.x * hr, from.y * vr, to.x * hr, to.y * vr, arrowSize, color);
        }
      }

      // Building path
      if (buildingCoords.length > 0) {
        ctx.strokeStyle = buildingColor;
        ctx.lineWidth = 1.5 * hr;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(buildingCoords[0].x * hr, buildingCoords[0].y * vr);
        for (let i = 1; i < buildingCoords.length; i++) {
          ctx.lineTo(buildingCoords[i].x * hr, buildingCoords[i].y * vr);
        }
        if (previewEnd) {
          ctx.lineTo(previewEnd.x * hr, previewEnd.y * vr);
        }
        ctx.stroke();

        for (const pt of buildingCoords) {
          drawFilledCircle(ctx, pt.x * hr, pt.y * vr, hr, buildingColor);
        }
      }
    });
  }

  drawBackground() {}
}

class PathToolPaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = {
    paths: [],
    selectedId: null,
    hoveredId: null,
    marqueeIds: new Set(),
    buildingCoords: [],
    previewEnd: null,
    buildingColor: DEFAULT_DRAWING_STYLE.color,
  };

  constructor(private readonly source: PathToolPrimitive) {}

  update() {
    const { paths, selectedId, hoveredId, marqueeIds, buildingPoints, previewPoint, buildingColor, chart, series } = this.source;
    this.viewData.buildingColor = buildingColor;

    if (!chart || !series) {
      this.viewData.paths = [];
      this.viewData.buildingCoords = [];
      this.viewData.previewEnd = null;
      return;
    }

    const entries: PathViewEntry[] = [];
    for (const path of paths) {
      const coords = projectPoints(chart, series, path.points) ?? [];
      if (coords.length >= 2) {
        entries.push({ id: path.id, coords, hasArrow: path.hasArrow, style: path.style });
      }
    }
    this.viewData.paths = entries;
    this.viewData.selectedId = selectedId;
    this.viewData.hoveredId = hoveredId;
    this.viewData.marqueeIds = marqueeIds;

    this.viewData.buildingCoords = projectPoints(chart, series, buildingPoints) ?? [];
    this.viewData.previewEnd = previewPoint;
  }

  renderer() {
    return new PathToolRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return this.source.dragging ? "top" : "normal";
  }
}

export class PathToolPrimitive extends SelectableDrawingPrimitive<PathToolPaneView, PathData> {
  protected readonly paneViewsInstance: PathToolPaneView[];

  paths: PathData[] = [];
  buildingPoints: PathPoint[] = [];
  previewPoint: PointXY | null = null;
  buildingColor: string = DEFAULT_DRAWING_STYLE.color;

  constructor() {
    super();
    this.paneViewsInstance = [new PathToolPaneView(this)];
  }

  protected override resetState() {
    this.buildingPoints = [];
    this.previewPoint = null;
  }

  /** Sync finalized paths from store. */
  setData(paths: PathData[]) {
    this.paths = paths;
    this.refresh();
  }

  addBuildingPoint(point: PathPoint) {
    this.buildingPoints = [...this.buildingPoints, point];
    this.refresh();
  }

  setPreview(point: PointXY | null) {
    this.previewPoint = point;
    this.refresh();
  }

  /** Finalize building points into a path. Returns the path data or null. */
  finalizeBuildingPoints(id: number, hasArrow: boolean, style: DrawingStyle): PathData | null {
    if (this.buildingPoints.length < 2) {
      this.buildingPoints = [];
      this.refresh();
      return null;
    }
    const path: PathData = { id, points: this.buildingPoints, hasArrow, style };
    this.buildingPoints = [];
    this.previewPoint = null;
    this.refresh();
    return path;
  }

  cancelBuilding() {
    this.buildingPoints = [];
    this.previewPoint = null;
    this.refresh();
  }

  /** Path ids with at least one point inside the marquee rect. */
  getEnclosedIds(rect: PixelRect): number[] {
    if (!this.chart || !this.series) return [];
    const ids: number[] = [];
    for (const path of this.paths) {
      for (const pt of path.points) {
        const projected = projectPoint(this.chart, this.series, pt);
        if (projected != null && pointInRect(projected.x, projected.y, rect)) {
          ids.push(path.id);
          break;
        }
      }
    }
    return ids;
  }

  cornerHitTest(x: number, y: number): { pathId: number; pointIndex: number } | null {
    if (!this.chart || !this.series) return null;
    let best: { pathId: number; pointIndex: number; dist: number } | null = null;
    for (const path of this.paths) {
      for (let i = 0; i < path.points.length; i++) {
        const projected = projectPoint(this.chart, this.series, path.points[i]);
        if (projected == null) continue;
        const dist = Math.hypot(x - projected.x, y - projected.y);
        if (
          withinPointTolerance(x, y, projected.x, projected.y, CORNER_HIT_TOLERANCE) &&
          (best === null || dist < best.dist)
        ) {
          best = { pathId: path.id, pointIndex: i, dist };
        }
      }
    }
    return best ? { pathId: best.pathId, pointIndex: best.pointIndex } : null;
  }

  pathHitTest(x: number, y: number): number | null {
    if (!this.chart || !this.series) return null;
    let bestId: number | null = null;
    for (const path of this.paths) {
      const coords = projectPoints(this.chart, this.series, path.points) ?? [];
      if (withinPolyline(x, y, coords, HIT_TOLERANCE)) {
        if (bestId === null || path.id > bestId) bestId = path.id;
      }
    }
    return bestId;
  }

  protected items() {
    return this.paths;
  }

  protected anchorPrice(item: PathData): number | null {
    return item.points[0]?.price ?? null;
  }
}
