import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  PrimitivePaneViewZOrder,
} from "lightweight-charts";
import { DrawingPrimitiveBase } from "./DrawingPrimitiveBase";
import { timeToCoordinateOrNearest, type MeasurePoint, type MeasurementData } from "../lib/chart-measure";

type ViewData = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  measurement: MeasurementData | null;
};

const BULLISH_COLOR = "#16c784";
const BULLISH_FILL = "rgba(22, 199, 132, 0.15)";
const BEARISH_COLOR = "#ea3943";
const BEARISH_FILL = "rgba(234, 57, 67, 0.15)";

const MIN_FONT = 12;
const MAX_FONT = 48;

function formatNum(n: number, decimals: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

class PctMeasuringRenderer implements IPrimitivePaneRenderer {
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

      const rectLeft = Math.min(sx, ex);
      const rectTop = Math.min(sy, ey);
      const rectW = Math.abs(ex - sx);
      const rectH = Math.abs(ey - sy);
      const midX = rectLeft + rectW / 2;
      const midY = rectTop + rectH / 2;

      // Filled rectangle
      ctx.fillStyle = fill;
      ctx.fillRect(rectLeft, rectTop, rectW, rectH);

      // Dynamic font size — scale with box height, clamped
      const rawFontSize = rectH * 0.3 / vr;
      const fontSize = Math.round(Math.max(MIN_FONT, Math.min(MAX_FONT, rawFontSize)) * vr);

      const sign = measurement.pctChange >= 0 ? "+" : "";
      const text = `${sign}${formatNum(measurement.pctChange, 2)}%`;

      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Text shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      const shadowOffset = Math.max(1, Math.round(fontSize * 0.06));
      ctx.fillText(text, midX + shadowOffset, midY + shadowOffset);

      ctx.fillStyle = color;
      ctx.fillText(text, midX, midY);
    });
  }

  drawBackground() {}
}

class PctMeasuringPaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = {
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    measurement: null,
  };

  constructor(private readonly source: PctMeasuringPrimitive) {}

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
    return new PctMeasuringRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "normal";
  }
}

export class PctMeasuringPrimitive extends DrawingPrimitiveBase<PctMeasuringPaneView> {
  protected readonly paneViewsInstance: PctMeasuringPaneView[];

  startPoint: MeasurePoint | null = null;
  endPoint: MeasurePoint | null = null;
  measurement: MeasurementData | null = null;

  constructor() {
    super();
    this.paneViewsInstance = [new PctMeasuringPaneView(this)];
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
