import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  PrimitiveHoveredItem,
  PrimitivePaneViewZOrder,
} from "lightweight-charts";
import { SelectableDrawingPrimitive } from "./DrawingPrimitiveBase";
import { crispLineCenterY, drawSelectionDot, setFont, formatChartPrice, lineBitmapWidth } from "./chart-drawing";
import { projectPoint, timeToCoordinateOrNearest } from "../lib/chart-measure";
import { distToSegment, withinHorizontalLine, withinPointTolerance } from "../lib/drawing-geometry";
import { pointInRect, type PixelRect } from "../lib/marquee-select";
import { dashPattern, type DrawingStyle } from "../lib/drawing-style";
import type { FibData } from "../model";
import { visibleFibLevels } from "../lib/fib-levels";

const LINE_HIT_TOLERANCE = 6;
const ENDPOINT_HIT_TOLERANCE = 8;
const LABEL_PAD = 6;

type LevelEntry = {
  y: number;
  level: number;
  priceLabel: string;
  /** Per-level color; unset falls back to the drawing's style color. */
  color?: string;
};

type FibViewEntry = {
  id: number;
  x1: number;
  x2: number;
  rightEdge: number;
  levels: LevelEntry[];
  style: DrawingStyle;
  p1Y: number;
  p2Y: number;
};

type PreviewData = {
  x1: number;
  x2: number;
  rightEdge: number;
  levels: LevelEntry[];
  style: DrawingStyle;
  p1Y: number;
  p2Y: number;
};

type ViewData = {
  entries: FibViewEntry[];
  selectedId: number | null;
  hoveredId: number | null;
  marqueeIds: ReadonlySet<number>;
  preview: PreviewData | null;
};

class FibonacciRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly viewData: ViewData) {}

  draw(target: CanvasRenderingTarget2D) {
    const { entries, selectedId, hoveredId, marqueeIds, preview } = this.viewData;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      for (const entry of entries) {
        const isSelected = entry.id === selectedId || marqueeIds.has(entry.id);
        this.drawFib(ctx, entry, hr, vr, isSelected, entry.id === hoveredId);
      }

      if (preview) {
        this.drawFibLines(ctx, preview, hr, vr, 0.6);
      }
    });
  }

  private drawFib(
    ctx: CanvasRenderingContext2D,
    entry: FibViewEntry,
    hr: number,
    vr: number,
    isSelected: boolean,
    isHovered: boolean,
  ) {
    this.drawFibLines(ctx, entry, hr, vr, entry.style.opacity);

    if (isSelected || isHovered) {
      const x1 = entry.x1 * hr;
      const x2 = entry.x2 * hr;
      const p1Y = entry.p1Y * vr;
      const p2Y = entry.p2Y * vr;
      // Selection dots at actual p1 and p2 positions
      drawSelectionDot(ctx, x1, p1Y, hr);
      drawSelectionDot(ctx, x2, p2Y, hr);
    }
  }

  private drawFibLines(
    ctx: CanvasRenderingContext2D,
    data: { x1: number; x2: number; rightEdge: number; levels: LevelEntry[]; style: DrawingStyle; p1Y: number; p2Y: number },
    hr: number,
    vr: number,
    alpha: number,
  ) {
    const { style, levels } = data;
    const left = Math.min(data.x1, data.x2) * hr;
    const right = data.rightEdge * hr;
    if (right - left < 1) return;

    const strokeBm = lineBitmapWidth(style.width, hr);
    const dash = dashPattern(style.pattern, strokeBm);

    for (const lvl of levels) {
      const y = crispLineCenterY(lvl.y * vr, strokeBm);
      const levelColor = lvl.color ?? style.color;

      ctx.strokeStyle = levelColor;
      ctx.lineWidth = strokeBm;
      ctx.globalAlpha = alpha;
      if (dash.length > 0) ctx.setLineDash(dash);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Label
      setFont(ctx, hr);
      const label = `${lvl.level} — ${lvl.priceLabel}`;
      const labelX = left + LABEL_PAD * hr;
      const labelY = y - LABEL_PAD * vr;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = levelColor;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      ctx.fillText(label, labelX, labelY);
      ctx.globalAlpha = 1;
    }

    // Dashed diagonal line from A (p1) to B (p2)
    const x1Bm = data.x1 * hr;
    const x2Bm = data.x2 * hr;
    const p1YBm = data.p1Y * vr;
    const p2YBm = data.p2Y * vr;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = strokeBm;
    ctx.globalAlpha = alpha;
    // Always dashed — it is the A→B guide, not one of the levels, so it does
    // not follow style.pattern. It does follow the width, like every other run.
    ctx.setLineDash(dashPattern("dashed", strokeBm));
    ctx.beginPath();
    ctx.moveTo(x1Bm, p1YBm);
    ctx.lineTo(x2Bm, p2YBm);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  drawBackground() {}
}

class FibonacciPaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = {
    entries: [],
    selectedId: null,
    hoveredId: null,
    marqueeIds: new Set(),
    preview: null,
  };

  constructor(private readonly source: FibonacciPrimitive) {}

  update() {
    const { fibs, selectedId, hoveredId, marqueeIds, previewCoords, chart, series, tickSize } = this.source;

    this.viewData.preview = previewCoords;
    this.viewData.selectedId = selectedId;
    this.viewData.hoveredId = hoveredId;
    this.viewData.marqueeIds = marqueeIds;

    if (!chart || !series) {
      this.viewData.entries = [];
      return;
    }

    const rightEdge = chart.timeScale().width();
    const result: FibViewEntry[] = [];
    for (const fib of fibs) {
      const proj1 = projectPoint(chart, series, fib.p1);
      const proj2 = projectPoint(chart, series, fib.p2);
      if (proj1 == null || proj2 == null) continue;
      const x1 = proj1.x;
      const x2 = proj2.x;
      const p1Y = proj1.y;
      const p2Y = proj2.y;

      const range = fib.p1.price - fib.p2.price;
      const levels: LevelEntry[] = visibleFibLevels(fib.levels).map((lvl) => {
        const price = fib.p2.price + range * lvl.value;
        const y = series.priceToCoordinate(price);
        return {
          y: y ?? 0,
          level: lvl.value,
          priceLabel: formatChartPrice(price, tickSize),
          color: lvl.color,
        };
      });

      result.push({
        id: fib.id,
        x1,
        x2,
        rightEdge,
        levels,
        style: fib.style,
        p1Y,
        p2Y,
      });
    }

    this.viewData.entries = result;
  }

  renderer() {
    return new FibonacciRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return this.source.dragging ? "top" : "normal";
  }
}

export class FibonacciPrimitive extends SelectableDrawingPrimitive<FibonacciPaneView, FibData> {
  protected readonly paneViewsInstance: FibonacciPaneView[];

  fibs: FibData[] = [];
  previewCoords: PreviewData | null = null;
  tickSize = 0.01;

  constructor() {
    super();
    this.paneViewsInstance = [new FibonacciPaneView(this)];
  }

  protected override resetState() {
    this.previewCoords = null;
  }

  setData(fibs: FibData[], tickSize?: number) {
    this.fibs = fibs;
    if (tickSize != null) this.tickSize = tickSize;
    this.refresh();
  }

  /** Fib ids with both endpoints inside the marquee rect (fully enclosed). */
  getEnclosedIds(rect: PixelRect): number[] {
    if (!this.chart || !this.series) return [];
    const ids: number[] = [];
    for (const fib of this.fibs) {
      const p1 = projectPoint(this.chart, this.series, fib.p1);
      const p2 = projectPoint(this.chart, this.series, fib.p2);
      if (p1 == null || p2 == null) continue;
      if (pointInRect(p1.x, p1.y, rect) && pointInRect(p2.x, p2.y, rect)) ids.push(fib.id);
    }
    return ids;
  }

  setPreview(data: PreviewData | null) {
    this.previewCoords = data;
    this.refresh();
  }

  endpointHitTest(x: number, y: number): { fibId: number; endpoint: "p1" | "p2" } | null {
    if (!this.chart || !this.series) return null;
    let best: { fibId: number; endpoint: "p1" | "p2"; dist: number } | null = null;

    for (const fib of this.fibs) {
      const p1 = projectPoint(this.chart, this.series, fib.p1);
      const p2 = projectPoint(this.chart, this.series, fib.p2);
      if (p1 == null || p2 == null) continue;

      const endpoints: [number, number, "p1" | "p2"][] = [
        [p1.x, p1.y, "p1"],
        [p2.x, p2.y, "p2"],
      ];

      for (const [cx, cy, ep] of endpoints) {
        const dist = Math.hypot(x - cx, y - cy);
        if (
          withinPointTolerance(x, y, cx, cy, ENDPOINT_HIT_TOLERANCE) &&
          (best === null || dist < best.dist)
        ) {
          best = { fibId: fib.id, endpoint: ep, dist };
        }
      }
    }
    return best ? { fibId: best.fibId, endpoint: best.endpoint } : null;
  }

  lineHitTest(x: number, y: number): number | null {
    if (!this.chart || !this.series) return null;
    const rightEdge = this.chart.timeScale().width();
    let bestId: number | null = null;

    for (const fib of this.fibs) {
      const x1 = timeToCoordinateOrNearest(this.chart, fib.p1.time);
      const x2 = timeToCoordinateOrNearest(this.chart, fib.p2.time);
      if (x1 == null || x2 == null) continue;

      const left = Math.min(x1, x2);
      if (x < left - LINE_HIT_TOLERANCE || x > rightEdge + LINE_HIT_TOLERANCE) continue;

      const y1 = this.series.priceToCoordinate(fib.p1.price);
      const y2 = this.series.priceToCoordinate(fib.p2.price);

      // Diagonal A→B line
      if (x1 != null && y1 != null && x2 != null && y2 != null) {
        if (distToSegment(x, y, x1, y1, x2, y2) <= LINE_HIT_TOLERANCE) {
          if (bestId === null || fib.id > bestId) bestId = fib.id;
          continue;
        }
      }

      const range = fib.p1.price - fib.p2.price;
      for (const lvl of visibleFibLevels(fib.levels)) {
        const price = fib.p2.price + range * lvl.value;
        const ly = this.series.priceToCoordinate(price);
        if (ly == null) continue;
        if (withinHorizontalLine(y, ly, LINE_HIT_TOLERANCE)) {
          if (bestId === null || fib.id > bestId) bestId = fib.id;
          break;
        }
      }
    }
    return bestId;
  }

  protected items() {
    return this.fibs;
  }

  protected anchorPrice(item: FibData): number | null {
    return Math.min(item.p1.price, item.p2.price);
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const ep = this.endpointHitTest(x, y);
    if (ep) return { cursorStyle: "move", externalId: `fib-ep:${ep.fibId}`, zOrder: "normal" };

    const lineId = this.lineHitTest(x, y);
    if (lineId != null) return { cursorStyle: "pointer", externalId: `fib-line:${lineId}`, zOrder: "normal" };

    return null;
  }
}
