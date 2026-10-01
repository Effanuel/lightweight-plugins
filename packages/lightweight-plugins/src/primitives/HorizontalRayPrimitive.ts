import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
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
import { dashPattern, type DrawingStyle } from "../lib/drawing-style";
import { projectPoint } from "../lib/chart-measure";
import { pointDist, withinHorizontalLine } from "../lib/drawing-geometry";
import { pointInRect, type PixelRect } from "../lib/marquee-select";

type RayStyle = DrawingStyle;

export type RayData = {
  id: number;
  price: number;
  time: number;
  style: RayStyle;
};

type RayViewEntry = {
  id: number;
  originX: number;
  y: number;
  style: RayStyle;
};

type ViewData = {
  rays: RayViewEntry[];
  selectedId: number | null;
  hoveredId: number | null;
  marqueeIds: ReadonlySet<number>;
  canvasWidth: number;
  previewY: number | null;
  previewX: number | null;
};

const PREVIEW_COLOR = "rgba(120, 123, 134, 0.6)";
const HIT_TOLERANCE = 5;

class HorizontalRayRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly viewData: ViewData) {}

  draw(target: CanvasRenderingTarget2D) {
    const { rays, selectedId, hoveredId, marqueeIds, canvasWidth, previewY, previewX } = this.viewData;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const wBm = canvasWidth * hr;

      for (const ray of rays) {
        const isSelected = ray.id === selectedId || marqueeIds.has(ray.id);
        const { color, width, pattern, opacity } = ray.style;
        const ox = ray.originX * hr;
        const strokeBm = lineBitmapWidth(width, vr);
        const yBm = crispLineCenterY(ray.y * vr, strokeBm);

        // Line with configured style
        ctx.globalAlpha = opacity ?? 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeBm;
        // Dashes run along x, so they scale off the horizontal stroke width —
        // strokeBm above is the line's vertical thickness.
        ctx.setLineDash(dashPattern(pattern, lineBitmapWidth(width, hr)));
        ctx.beginPath();
        ctx.moveTo(ox, yBm);
        ctx.lineTo(wBm, yBm);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        if (isSelected || ray.id === hoveredId) {
          drawSelectionDot(ctx, ox, yBm, hr);
        }
      }

      // Preview circle when tool is active
      if (previewY != null && previewX != null) {
        drawFilledCircle(ctx, previewX * hr, previewY * vr, hr, PREVIEW_COLOR);
      }
    });
  }

  drawBackground() {}
}

class HorizontalRayPaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = {
    rays: [],
    selectedId: null,
    hoveredId: null,
    marqueeIds: new Set(),
    canvasWidth: 0,
    previewY: null,
    previewX: null,
  };
  private axisLabels: PriceAxisLabel[] = [];

  constructor(private readonly source: HorizontalRayPrimitive) {}

  update() {
    const { rays, selectedId, hoveredId, marqueeIds, chart, series, container, previewY, previewX, tickSize } = this.source;

    this.viewData.previewY = previewY;
    this.viewData.previewX = previewX;

    if (!chart || !series || !container) {
      this.viewData.rays = [];
      this.axisLabels = [];
      return;
    }

    const entries: RayViewEntry[] = [];
    const labels: PriceAxisLabel[] = [];
    for (const ray of rays) {
      const projected = projectPoint(chart, series, ray);
      if (projected != null) {
        entries.push({ id: ray.id, originX: projected.x, y: projected.y, style: ray.style });
        labels.push(
          new PriceAxisLabel(projected.y, formatChartPrice(ray.price, tickSize), "#000000", ray.style.color),
        );
      }
    }

    this.viewData.rays = entries;
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
    return new HorizontalRayRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return this.source.dragging ? "top" : "normal";
  }
}

export class HorizontalRayPrimitive extends SelectableDrawingPrimitive<HorizontalRayPaneView, RayData> {
  protected readonly paneViewsInstance: HorizontalRayPaneView[];

  container: HTMLDivElement | null = null;

  rays: RayData[] = [];
  previewY: number | null = null;
  previewX: number | null = null;
  tickSize = 0.01;

  constructor() {
    super();
    this.paneViewsInstance = [new HorizontalRayPaneView(this)];
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
  setData(rays: RayData[], container: HTMLDivElement, tickSize: number) {
    this.rays = rays;
    this.container = container;
    this.tickSize = tickSize;
    this.refresh();
  }

  /** Ray ids whose origin point lies inside the marquee rect. */
  getEnclosedIds(rect: PixelRect): number[] {
    if (!this.series || !this.chart) return [];
    const ids: number[] = [];
    for (const ray of this.rays) {
      const projected = projectPoint(this.chart, this.series, ray);
      if (projected != null && pointInRect(projected.x, projected.y, rect)) ids.push(ray.id);
    }
    return ids;
  }

  setPreview(x: number | null, y: number | null) {
    this.previewX = x;
    this.previewY = y;
    this.refresh();
  }

  rayHitTest(x: number, y: number): number | null {
    if (!this.series || !this.chart) return null;
    let bestId: number | null = null;
    for (const ray of this.rays) {
      const projected = projectPoint(this.chart, this.series, ray);
      if (projected != null && x >= projected.x && withinHorizontalLine(y, projected.y, HIT_TOLERANCE)) {
        if (bestId === null || ray.id > bestId) bestId = ray.id;
      }
    }
    return bestId;
  }

  /** Returns the ray id whose origin dot is closest to (x,y), or null if none within tolerance. */
  originHitTest(x: number, y: number): number | null {
    if (!this.series || !this.chart) return null;
    let bestId: number | null = null;
    let bestDist = HIT_TOLERANCE * 2;
    for (const ray of this.rays) {
      const projected = projectPoint(this.chart, this.series, ray);
      if (projected == null) continue;
      const dist = pointDist(x, y, projected.x, projected.y);
      if (dist <= bestDist) {
        bestDist = dist;
        bestId = ray.id;
      }
    }
    return bestId;
  }

  protected items() {
    return this.rays;
  }

  protected anchorPrice(item: RayData): number | null {
    return item.price;
  }
}
