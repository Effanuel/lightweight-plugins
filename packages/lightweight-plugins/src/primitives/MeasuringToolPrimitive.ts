import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  PrimitivePaneViewZOrder,
} from "lightweight-charts";
import { DrawingPrimitiveBase } from "./DrawingPrimitiveBase";
import { crispLineCenterY, crispRect, lineBitmapWidth, tickDecimals } from "./chart-drawing";
import { timeToCoordinateOrNearest, type MeasurePoint, type MeasurementData } from "../lib/chart-measure";

type ViewData = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  measurement: MeasurementData | null;
};

const FONT_SIZE = 11;
const TOOLTIP_PAD_H = 10;
const TOOLTIP_PAD_V = 5;
const TOOLTIP_LINE_HEIGHT = 16;
const TOOLTIP_BORDER_RADIUS = 4;
const TOOLTIP_GAP = 6;

const BULLISH_COLOR = "#16c784";
const BULLISH_FILL = "rgba(22, 199, 132, 0.15)";
const BEARISH_COLOR = "#ea3943";
const BEARISH_FILL = "rgba(234, 57, 67, 0.15)";

function formatNum(n: number, decimals: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

class MeasuringToolRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly viewData: ViewData) {}

  draw(target: CanvasRenderingTarget2D) {
    const { measurement, startX, startY, endX, endY } = this.viewData;
    if (!measurement) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      const sx = startX * hr;
      const sy = startY * vr;
      const ex = endX * hr;
      const ey = endY * vr;

      const isBullish = measurement.priceDiff >= 0;
      const color = isBullish ? BULLISH_COLOR : BEARISH_COLOR;
      const fill = isBullish ? BULLISH_FILL : BEARISH_FILL;

      const rect = crispRect(Math.min(sx, ex), Math.min(sy, ey), Math.max(sx, ex), Math.max(sy, ey), 0);
      const rectLeft = rect.left;
      const rectTop = rect.top;
      const rectW = rect.right - rect.left;
      const rectH = rect.bottom - rect.top;

      // Filled rectangle (no border)
      ctx.fillStyle = fill;
      ctx.fillRect(rectLeft, rectTop, rectW, rectH);

      // Centered arrows — shafts snapped to whole bitmap pixels
      const strokeBm = lineBitmapWidth(1, hr);
      const shaftY = crispLineCenterY(rectTop + rectH / 2, strokeBm);
      const shaftX = crispLineCenterY(rectLeft + rectW / 2, strokeBm);
      const arrowSize = 5 * hr;

      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = strokeBm;

      // Horizontal arrow (left → right through vertical center)
      ctx.beginPath();
      ctx.moveTo(rectLeft, shaftY);
      ctx.lineTo(rectLeft + rectW, shaftY);
      ctx.stroke();
      // Right arrowhead
      const hDir = ex > sx ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(rectLeft + (hDir > 0 ? rectW : 0), shaftY);
      ctx.lineTo(rectLeft + (hDir > 0 ? rectW : 0) - arrowSize * hDir, shaftY - arrowSize);
      ctx.lineTo(rectLeft + (hDir > 0 ? rectW : 0) - arrowSize * hDir, shaftY + arrowSize);
      ctx.closePath();
      ctx.fill();

      // Vertical arrow (top → bottom through horizontal center)
      ctx.beginPath();
      ctx.moveTo(shaftX, rectTop);
      ctx.lineTo(shaftX, rectTop + rectH);
      ctx.stroke();
      // Bottom arrowhead
      const vDir = ey > sy ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(shaftX, rectTop + (vDir > 0 ? rectH : 0));
      ctx.lineTo(shaftX - arrowSize, rectTop + (vDir > 0 ? rectH : 0) - arrowSize * vDir);
      ctx.lineTo(shaftX + arrowSize, rectTop + (vDir > 0 ? rectH : 0) - arrowSize * vDir);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;

      // Tooltip: top for bullish, bottom for bearish
      if (isBullish) {
        this.drawTooltip(ctx, rectLeft + rectW / 2, rectTop, hr, vr, measurement, color, scope.bitmapSize.width, "above");
      } else {
        this.drawTooltip(ctx, rectLeft + rectW / 2, rectTop + rectH, hr, vr, measurement, color, scope.bitmapSize.width, "below");
      }
    });
  }

  private drawTooltip(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    edgeY: number,
    hr: number,
    vr: number,
    m: MeasurementData,
    color: string,
    canvasW: number,
    position: "above" | "below",
  ) {
    const fontSize = Math.round(FONT_SIZE * vr);
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`;

    const sign = m.priceDiff >= 0 ? "+" : "";
    const decimals = tickDecimals(m.tickSize);
    const line1 = `${sign}${formatNum(m.priceDiff, decimals)} (${sign}${formatNum(m.pctChange, 2)}%) ${sign}${Math.round(m.points)}`;
    const line2 = `${m.bars} bars, ${m.days}d`;

    const lines = [line1, line2];
    const lineWidths = lines.map((l) => ctx.measureText(l).width);
    const maxW = Math.max(...lineWidths);

    const padH = TOOLTIP_PAD_H * hr;
    const padV = TOOLTIP_PAD_V * vr;
    const lineH = TOOLTIP_LINE_HEIGHT * vr;
    const radius = TOOLTIP_BORDER_RADIUS * hr;
    const gap = TOOLTIP_GAP * vr;

    const boxW = maxW + padH * 2;
    const boxH = lineH * lines.length + padV * 2;

    let tx = centerX - boxW / 2;
    const ty = position === "below" ? edgeY + gap : edgeY - gap - boxH;

    if (tx < 0) tx = 0;
    if (tx + boxW > canvasW) tx = canvasW - boxW;

    // Snap the tooltip rect so its 1px border covers whole bitmap pixels
    const strokeBm = lineBitmapWidth(1, hr);
    const box = crispRect(tx, ty, tx + boxW, ty + boxH, strokeBm);
    const bx = box.left;
    const by = box.top;
    const bw = box.right - box.left;
    const bh = box.bottom - box.top;

    // Background
    ctx.fillStyle = "rgba(10, 10, 15, 0.92)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, radius);
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeBm;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, radius);
    ctx.stroke();

    // Text — each line centered
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    const textCenterX = bx + bw / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textCenterX, by + padV + i * lineH);
    }
  }

  drawBackground() {}
}

class MeasuringToolPaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = {
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    measurement: null,
  };

  constructor(private readonly source: MeasuringToolPrimitive) {}

  update() {
    const { startPoint, endPoint, measurement } = this.source;
    if (!startPoint || !endPoint || !this.source.series) {
      this.viewData.measurement = null;
      return;
    }

    const chart = this.source.chart;
    const series = this.source.series;
    if (!chart) {
      this.viewData.measurement = null;
      return;
    }

    const startY = series.priceToCoordinate(startPoint.price);
    const endY = series.priceToCoordinate(endPoint.price);
    const startX = timeToCoordinateOrNearest(chart, startPoint.time);
    const endX = timeToCoordinateOrNearest(chart, endPoint.time);

    if (startY == null || endY == null || startX == null || endX == null) {
      this.viewData.measurement = null;
      return;
    }

    this.viewData.startX = startX;
    this.viewData.startY = startY;
    this.viewData.endX = endX;
    this.viewData.endY = endY;
    this.viewData.measurement = measurement;
  }

  renderer() {
    return new MeasuringToolRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "normal";
  }
}

export class MeasuringToolPrimitive extends DrawingPrimitiveBase<MeasuringToolPaneView> {
  protected readonly paneViewsInstance: MeasuringToolPaneView[];

  startPoint: MeasurePoint | null = null;
  endPoint: MeasurePoint | null = null;
  measurement: MeasurementData | null = null;

  constructor() {
    super();
    this.paneViewsInstance = [new MeasuringToolPaneView(this)];
  }

  protected override resetState() {
    this.startPoint = null;
    this.endPoint = null;
    this.measurement = null;
  }

  setMeasurement(start: MeasurePoint, end: MeasurePoint, data: MeasurementData) {
    this.startPoint = start;
    this.endPoint = end;
    this.measurement = data;
    this.refresh();
  }

  clearMeasurement() {
    this.resetState();
    this.refresh();
  }
}
