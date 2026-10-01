import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  PrimitiveHoveredItem,
  PrimitivePaneViewZOrder,
} from "lightweight-charts";
import { SelectableDrawingPrimitive } from "./DrawingPrimitiveBase";
import {
  crispLineCenterY,
  drawFilledCircle,
  drawSelectionDot,
  formatChartPrice,
  lineBitmapWidth,
  PriceAxisLabel,
} from "./chart-drawing";
import { projectPoint } from "../lib/chart-measure";
import { pointDist, withinHorizontalLine } from "../lib/drawing-geometry";
import { pointInRect, type PixelRect } from "../lib/marquee-select";
import { dashPattern, type DrawingStyle } from "../lib/drawing-style";

export type HLineData = {
  id: number;
  price: number;
  time: number;
  style: DrawingStyle;
};

type HLineViewEntry = { id: number; originX: number; y: number; style: DrawingStyle };

type ViewData = {
  lines: HLineViewEntry[];
  selectedId: number | null;
  hoveredId: number | null;
  marqueeIds: ReadonlySet<number>;
  canvasWidth: number;
  previewY: number | null;
  previewX: number | null;
};

const PREVIEW_COLOR = "rgba(120, 123, 134, 0.6)";
const HIT_TOLERANCE = 5;

class HorizontalLineRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly viewData: ViewData) {}

  draw(target: CanvasRenderingTarget2D) {
    const { lines, selectedId, hoveredId, marqueeIds, canvasWidth, previewY, previewX } = this.viewData;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const wBm = canvasWidth * hr;

      for (const line of lines) {
        const isSelected = line.id === selectedId || marqueeIds.has(line.id);
        const { color, width, pattern, opacity } = line.style;
        const strokeBm = lineBitmapWidth(width, vr);
        const yBm = crispLineCenterY(line.y * vr, strokeBm);

        ctx.globalAlpha = opacity ?? 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeBm;
        // Dashes run along x, so they scale off the horizontal stroke width —
        // strokeBm above is the line's vertical thickness.
        ctx.setLineDash(dashPattern(pattern, lineBitmapWidth(width, hr)));
        ctx.beginPath();
        ctx.moveTo(0, yBm);
        ctx.lineTo(wBm, yBm);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        if (isSelected || line.id === hoveredId) {
          drawSelectionDot(ctx, line.originX * hr, yBm, hr);
        }
      }

      if (previewY != null && previewX != null) {
        drawFilledCircle(ctx, previewX * hr, previewY * vr, hr, PREVIEW_COLOR);
      }
    });
  }

  drawBackground() {}
}

class HorizontalLinePaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = {
    lines: [],
    selectedId: null,
    hoveredId: null,
    marqueeIds: new Set(),
    canvasWidth: 0,
    previewY: null,
    previewX: null,
  };
  private axisLabels: PriceAxisLabel[] = [];

  constructor(private readonly source: HorizontalLinePrimitive) {}

  update() {
    const { lines, selectedId, hoveredId, marqueeIds, chart, series, container, previewY, previewX, tickSize } =
      this.source;

    this.viewData.previewY = previewY;
    this.viewData.previewX = previewX;

    if (!chart || !series || !container) {
      this.viewData.lines = [];
      this.axisLabels = [];
      return;
    }

    const entries: HLineViewEntry[] = [];
    const labels: PriceAxisLabel[] = [];
    for (const line of lines) {
      const projected = projectPoint(chart, series, line);
      if (projected != null) {
        entries.push({ id: line.id, originX: projected.x, y: projected.y, style: line.style });
        labels.push(
          new PriceAxisLabel(projected.y, formatChartPrice(line.price, tickSize), "#000000", line.style.color),
        );
      }
    }

    this.viewData.lines = entries;
    this.viewData.selectedId = selectedId;
    this.viewData.hoveredId = hoveredId;
    this.viewData.marqueeIds = marqueeIds;
    this.viewData.canvasWidth = container.clientWidth;
    this.axisLabels = labels;
  }

  getAxisLabels(): readonly PriceAxisLabel[] {
    return this.axisLabels;
  }

  renderer() {
    return new HorizontalLineRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return this.source.dragging ? "top" : "normal";
  }
}

export class HorizontalLinePrimitive extends SelectableDrawingPrimitive<HorizontalLinePaneView, HLineData> {
  protected readonly paneViewsInstance: HorizontalLinePaneView[];

  container: HTMLDivElement | null = null;

  lines: HLineData[] = [];
  previewY: number | null = null;
  previewX: number | null = null;
  tickSize = 0.01;

  constructor() {
    super();
    this.paneViewsInstance = [new HorizontalLinePaneView(this)];
  }

  protected override resetState() {
    this.previewY = null;
    this.previewX = null;
    this.container = null;
  }

  priceAxisViews() {
    return this.paneViewsInstance[0].getAxisLabels();
  }

  /** Sync data from store into the primitive for rendering. */
  setData(lines: HLineData[], container: HTMLDivElement, tickSize: number) {
    this.lines = lines;
    this.container = container;
    this.tickSize = tickSize;
    this.refresh();
  }

  /** Line ids whose anchor point lies inside the marquee rect. */
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

  /** Full-width line: a hit is any y within tolerance of the row, regardless of x. */
  lineHitTest(_x: number, y: number): number | null {
    if (!this.series || !this.chart) return null;
    let bestId: number | null = null;
    for (const line of this.lines) {
      const projected = projectPoint(this.chart, this.series, line);
      if (projected != null && withinHorizontalLine(y, projected.y, HIT_TOLERANCE)) {
        if (bestId === null || line.id > bestId) bestId = line.id;
      }
    }
    return bestId;
  }

  /** Returns the line id whose origin dot is closest to (x, y), or null if none within tolerance. */
  originHitTest(x: number, y: number): number | null {
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
    const originId = this.originHitTest(x, y);
    if (originId != null) return { cursorStyle: "move", externalId: `hline-origin:${originId}`, zOrder: "normal" };
    const lineId = this.lineHitTest(x, y);
    if (lineId != null) return { cursorStyle: "pointer", externalId: `hline:${lineId}`, zOrder: "normal" };
    return null;
  }

  protected items() {
    return this.lines;
  }

  protected anchorPrice(item: HLineData): number | null {
    return item.price;
  }
}
