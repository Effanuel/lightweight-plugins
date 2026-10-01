import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { IPrimitivePaneRenderer, IPrimitivePaneView, PrimitiveHoveredItem, PrimitivePaneViewZOrder } from "lightweight-charts";
import { SelectableDrawingPrimitive } from "./DrawingPrimitiveBase";
import { drawSelectionDot, lineBitmapWidth } from "./chart-drawing";
import { projectPoint } from "../lib/chart-measure";
import { distToSegment, withinPointTolerance } from "../lib/drawing-geometry";
import { pointInRect, type PixelRect } from "../lib/marquee-select";
import { dashPattern, type DrawingStyle } from "../lib/drawing-style";

export type TrendData = {
  id: number;
  p1: { price: number; time: number };
  p2: { price: number; time: number };
  style: DrawingStyle;
};

export type TrendPreview = { x1: number; y1: number; x2: number; y2: number; style: DrawingStyle };

const LINE_HIT_TOLERANCE = 6;
const ENDPOINT_HIT_TOLERANCE = 8;
const PREVIEW_ALPHA = 0.6;

type TrendViewEntry = { id: number; x1: number; y1: number; x2: number; y2: number; style: DrawingStyle };

type ViewData = {
  entries: TrendViewEntry[];
  selectedId: number | null;
  hoveredId: number | null;
  marqueeIds: ReadonlySet<number>;
  preview: TrendPreview | null;
};

class TrendLineRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly viewData: ViewData) {}

  draw(target: CanvasRenderingTarget2D) {
    const { entries, selectedId, hoveredId, marqueeIds, preview } = this.viewData;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      for (const e of entries) {
        const isSelected = e.id === selectedId || marqueeIds.has(e.id);
        this.drawSegment(ctx, e, hr, vr, e.style.opacity ?? 1);
        if (isSelected || e.id === hoveredId) {
          drawSelectionDot(ctx, e.x1 * hr, e.y1 * vr, hr);
          drawSelectionDot(ctx, e.x2 * hr, e.y2 * vr, hr);
        }
      }
      if (preview) this.drawSegment(ctx, preview, hr, vr, PREVIEW_ALPHA);
    });
  }

  private drawSegment(
    ctx: CanvasRenderingContext2D,
    s: { x1: number; y1: number; x2: number; y2: number; style: DrawingStyle },
    hr: number,
    vr: number,
    alpha: number,
  ) {
    const strokeBm = lineBitmapWidth(s.style.width, hr);
    const dash = dashPattern(s.style.pattern, strokeBm);
    ctx.strokeStyle = s.style.color;
    ctx.lineWidth = strokeBm;
    ctx.globalAlpha = alpha;
    if (dash.length > 0) ctx.setLineDash(dash);
    else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(s.x1 * hr, s.y1 * vr);
    ctx.lineTo(s.x2 * hr, s.y2 * vr);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  drawBackground() {}
}

class TrendLinePaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = {
    entries: [],
    selectedId: null,
    hoveredId: null,
    marqueeIds: new Set(),
    preview: null,
  };

  constructor(private readonly source: TrendLinePrimitive) {}

  update() {
    const { trends, selectedId, hoveredId, marqueeIds, previewCoords, chart, series } = this.source;
    this.viewData.preview = previewCoords;
    this.viewData.selectedId = selectedId;
    this.viewData.hoveredId = hoveredId;
    this.viewData.marqueeIds = marqueeIds;

    if (!chart || !series) {
      this.viewData.entries = [];
      return;
    }

    const result: TrendViewEntry[] = [];
    for (const t of trends) {
      const p1 = projectPoint(chart, series, t.p1);
      const p2 = projectPoint(chart, series, t.p2);
      if (p1 == null || p2 == null) continue;
      result.push({ id: t.id, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, style: t.style });
    }
    this.viewData.entries = result;
  }

  renderer() {
    return new TrendLineRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return this.source.dragging ? "top" : "normal";
  }
}

export class TrendLinePrimitive extends SelectableDrawingPrimitive<TrendLinePaneView, TrendData> {
  protected readonly paneViewsInstance: TrendLinePaneView[];

  trends: TrendData[] = [];
  previewCoords: TrendPreview | null = null;

  constructor() {
    super();
    this.paneViewsInstance = [new TrendLinePaneView(this)];
  }

  protected override resetState() {
    this.previewCoords = null;
  }

  setData(trends: TrendData[]) {
    this.trends = trends;
    this.refresh();
  }

  setPreview(data: TrendPreview | null) {
    this.previewCoords = data;
    this.refresh();
  }

  /** Trend ids with either projected endpoint inside the marquee rect. */
  getEnclosedIds(rect: PixelRect): number[] {
    if (!this.chart || !this.series) return [];
    const ids: number[] = [];
    for (const t of this.trends) {
      const p1 = projectPoint(this.chart, this.series, t.p1);
      const p2 = projectPoint(this.chart, this.series, t.p2);
      if (p1 == null || p2 == null) continue;
      if (pointInRect(p1.x, p1.y, rect) || pointInRect(p2.x, p2.y, rect)) ids.push(t.id);
    }
    return ids;
  }

  endpointHitTest(x: number, y: number): { trendId: number; endpoint: "p1" | "p2" } | null {
    if (!this.chart || !this.series) return null;
    let best: { trendId: number; endpoint: "p1" | "p2"; dist: number } | null = null;
    for (const t of this.trends) {
      const p1 = projectPoint(this.chart, this.series, t.p1);
      const p2 = projectPoint(this.chart, this.series, t.p2);
      if (p1 == null || p2 == null) continue;
      const endpoints: [number, number, "p1" | "p2"][] = [
        [p1.x, p1.y, "p1"],
        [p2.x, p2.y, "p2"],
      ];
      for (const [cx, cy, ep] of endpoints) {
        const dist = Math.hypot(x - cx, y - cy);
        if (withinPointTolerance(x, y, cx, cy, ENDPOINT_HIT_TOLERANCE) && (best === null || dist < best.dist)) {
          best = { trendId: t.id, endpoint: ep, dist };
        }
      }
    }
    return best ? { trendId: best.trendId, endpoint: best.endpoint } : null;
  }

  lineHitTest(x: number, y: number): number | null {
    if (!this.chart || !this.series) return null;
    let bestId: number | null = null;
    for (const t of this.trends) {
      const p1 = projectPoint(this.chart, this.series, t.p1);
      const p2 = projectPoint(this.chart, this.series, t.p2);
      if (p1 == null || p2 == null) continue;
      if (distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) <= LINE_HIT_TOLERANCE) {
        if (bestId === null || t.id > bestId) bestId = t.id;
      }
    }
    return bestId;
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const ep = this.endpointHitTest(x, y);
    if (ep) return { cursorStyle: "move", externalId: `trend-ep:${ep.trendId}`, zOrder: "normal" };
    const lineId = this.lineHitTest(x, y);
    if (lineId != null) return { cursorStyle: "pointer", externalId: `trend-line:${lineId}`, zOrder: "normal" };
    return null;
  }

  protected items() {
    return this.trends;
  }

  protected anchorPrice(item: TrendData): number | null {
    return Math.min(item.p1.price, item.p2.price);
  }
}
