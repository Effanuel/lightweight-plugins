import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { IPrimitivePaneRenderer, IPrimitivePaneView, PrimitivePaneViewZOrder, PrimitiveHoveredItem } from "lightweight-charts";
import { SelectableDrawingPrimitive } from "./DrawingPrimitiveBase";
import { crispLineCenterY, drawFilledCircle, drawSelectionDot, lineBitmapWidth, TimeAxisLabel } from "./chart-drawing";
import { projectPoint } from "../lib/chart-measure";
import { pointDist, withinVerticalLine } from "../lib/drawing-geometry";
import { pointInRect, type PixelRect } from "../lib/marquee-select";
import { dashPattern, type DrawingStyle } from "../lib/drawing-style";

export type VLineData = {
  id: number;
  time: number;
  price: number;
  style: DrawingStyle;
};

type VLineViewEntry = { id: number; x: number; anchorY: number; style: DrawingStyle };

type ViewData = {
  lines: VLineViewEntry[];
  selectedId: number | null;
  hoveredId: number | null;
  marqueeIds: ReadonlySet<number>;
  canvasHeight: number;
  previewX: number | null;
  previewY: number | null;
};

const PREVIEW_COLOR = "rgba(120, 123, 134, 0.6)";
const HIT_TOLERANCE = 5;

/** Format a unix-seconds timestamp as a compact time-axis label. */
// TODO: uses local timezone (getHours/getDate/etc.); if the chart time axis is ever configured for UTC, switch to getUTC* to match.
function formatTimeLabel(timeSec: number): string {
  const d = new Date(timeSec * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

class VerticalLineRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly viewData: ViewData) {}

  draw(target: CanvasRenderingTarget2D) {
    const { lines, selectedId, hoveredId, marqueeIds, canvasHeight, previewX, previewY } = this.viewData;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const hBm = canvasHeight * vr;

      for (const line of lines) {
        const isSelected = line.id === selectedId || marqueeIds.has(line.id);
        const { color, width, pattern, opacity } = line.style;
        const strokeBm = lineBitmapWidth(width, hr);
        const xBm = crispLineCenterY(line.x * hr, strokeBm); // axis-agnostic crisp snap

        ctx.globalAlpha = opacity ?? 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeBm;
        // Dashes run along y, so they scale off the vertical stroke width —
        // strokeBm above is the line's horizontal thickness.
        ctx.setLineDash(dashPattern(pattern, lineBitmapWidth(width, vr)));
        ctx.beginPath();
        ctx.moveTo(xBm, 0);
        ctx.lineTo(xBm, hBm);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        if (isSelected || line.id === hoveredId) {
          drawSelectionDot(ctx, xBm, line.anchorY * vr, hr);
        }
      }

      if (previewX != null && previewY != null) {
        drawFilledCircle(ctx, previewX * hr, previewY * vr, hr, PREVIEW_COLOR);
      }
    });
  }

  drawBackground() {}
}

class VerticalLinePaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = {
    lines: [],
    selectedId: null,
    hoveredId: null,
    marqueeIds: new Set(),
    canvasHeight: 0,
    previewX: null,
    previewY: null,
  };
  private axisLabels: TimeAxisLabel[] = [];

  constructor(private readonly source: VerticalLinePrimitive) {}

  update() {
    const { lines, selectedId, hoveredId, marqueeIds, chart, series, container, previewX, previewY } = this.source;

    this.viewData.previewX = previewX;
    this.viewData.previewY = previewY;

    if (!chart || !series || !container) {
      this.viewData.lines = [];
      this.axisLabels = [];
      return;
    }

    const entries: VLineViewEntry[] = [];
    const labels: TimeAxisLabel[] = [];
    for (const line of lines) {
      const projected = projectPoint(chart, series, line);
      if (projected != null) {
        entries.push({ id: line.id, x: projected.x, anchorY: projected.y, style: line.style });
        labels.push(new TimeAxisLabel(projected.x, formatTimeLabel(line.time), "#000000", line.style.color));
      }
    }

    this.viewData.lines = entries;
    this.viewData.selectedId = selectedId;
    this.viewData.hoveredId = hoveredId;
    this.viewData.marqueeIds = marqueeIds;
    this.viewData.canvasHeight = container.clientHeight;
    this.axisLabels = labels;
  }

  getAxisLabels(): readonly TimeAxisLabel[] {
    return this.axisLabels;
  }

  renderer() {
    return new VerticalLineRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return this.source.dragging ? "top" : "normal";
  }
}

export class VerticalLinePrimitive extends SelectableDrawingPrimitive<VerticalLinePaneView, VLineData> {
  protected readonly paneViewsInstance: VerticalLinePaneView[];

  container: HTMLDivElement | null = null;

  lines: VLineData[] = [];
  previewX: number | null = null;
  previewY: number | null = null;

  constructor() {
    super();
    this.paneViewsInstance = [new VerticalLinePaneView(this)];
  }

  protected override resetState() {
    this.previewX = null;
    this.previewY = null;
    this.container = null;
  }

  timeAxisViews() {
    return this.paneViewsInstance[0].getAxisLabels();
  }

  setData(lines: VLineData[], container: HTMLDivElement) {
    this.lines = lines;
    this.container = container;
    this.refresh();
  }

  getEnclosedIds(rect: PixelRect): number[] {
    if (!this.series || !this.chart) return [];
    const ids: number[] = [];
    for (const line of this.lines) {
      const projected = projectPoint(this.chart, this.series, line);
      if (projected != null && pointInRect(projected.x, projected.y, rect)) ids.push(line.id);
    }
    return ids;
  }

  setPreview(x: number | null, y: number | null) {
    this.previewX = x;
    this.previewY = y;
    this.refresh();
  }

  /** Full-height line: a hit is any x within tolerance of the column, regardless of y. */
  lineHitTest(x: number, _y: number): number | null {
    if (!this.series || !this.chart) return null;
    let bestId: number | null = null;
    for (const line of this.lines) {
      const projected = projectPoint(this.chart, this.series, line);
      if (projected != null && withinVerticalLine(x, projected.x, HIT_TOLERANCE)) {
        if (bestId === null || line.id > bestId) bestId = line.id;
      }
    }
    return bestId;
  }

  anchorHitTest(x: number, y: number): number | null {
    if (!this.series || !this.chart) return null;
    let bestId: number | null = null;
    let bestDist = HIT_TOLERANCE * 2;
    for (const line of this.lines) {
      const projected = projectPoint(this.chart, this.series, line);
      if (projected == null) continue;
      const dist = pointDist(x, y, projected.x, projected.y);
      if (dist <= bestDist) {
        bestDist = dist;
        bestId = line.id;
      }
    }
    return bestId;
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const anchorId = this.anchorHitTest(x, y);
    if (anchorId != null) return { cursorStyle: "move", externalId: `vline-anchor:${anchorId}`, zOrder: "normal" };
    const lineId = this.lineHitTest(x, y);
    if (lineId != null) return { cursorStyle: "pointer", externalId: `vline:${lineId}`, zOrder: "normal" };
    return null;
  }

  protected items() {
    return this.lines;
  }

  /** Y coordinate of the anchor price — used to position the settings popup. */
  protected anchorPrice(item: VLineData): number | null {
    return item.price;
  }
}
