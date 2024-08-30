import { CanvasRenderingTarget2D } from "fancy-canvas";
import {
  Coordinate,
  IChartApi,
  isBusinessDay,
  ISeriesApi,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  MouseEventParams,
  SeriesType,
  Time,
} from "lightweight-charts";
import { ensureDefined } from "../utils/assertions";
import { PluginBase } from "./plugin-base";
import { positionsBox } from "../utils/positions";
import { drawCircleBody, fillRectWithBorder } from "../utils/draw";
import type { MousePosition } from "../utils/mouse";

interface PaneRendererUpdateParams {
  p1: ViewPoint;
  p2: ViewPoint;
  p3: ViewPoint;
  p4: ViewPoint;
  mouse: MousePosition | null;
  fillColor: string;
  isHovered: boolean;
  isSelected: boolean;
  hoveringPoint: "p1" | "p2" | "p3" | "p4" | null;
}

class RectanglePaneRenderer implements ISeriesPrimitivePaneRenderer {
  private params: PaneRendererUpdateParams | null = null;

  update(params: PaneRendererUpdateParams) {
    this.params = params;
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope) => {
      const { p1, p2, p3, p4, isHovered, isSelected } = this.params ?? {};
      const isHighlighted = isHovered || isSelected;
      if (
        p1?.x == null ||
        p1?.y == null ||
        p2?.x == null ||
        p2?.y == null ||
        p3?.x == null ||
        p3.y == null ||
        p4?.x == null ||
        p4.y == null
      )
        return;
      const ctx = scope.context;

      const horizontalPositions = positionsBox(p1.x, p2.x, scope.horizontalPixelRatio);
      const verticalPositions = positionsBox(p1.y, p2.y, scope.verticalPixelRatio);
      const pp4_y = positionsBox(p2.y, p4.y, scope.verticalPixelRatio);

      const stopLossBgColor = isHighlighted ? "rgba(255, 0, 0, 0.4)" : "rgba(255, 0, 0, 0.2)";
      const profitBgColor = isHighlighted ? "rgba(0, 255, 0, 0.4)" : "rgba(0, 255, 0, 0.2)";

      const long = p2.price && p1.price && p2.price < p1.price;

      const point1_x = horizontalPositions.position;
      const point1_y = verticalPositions.position;

      const point2_x = horizontalPositions.position + horizontalPositions.length;
      const point2_y = verticalPositions.position + verticalPositions.length;

      const point4_x = horizontalPositions.position + horizontalPositions.length;

      ctx.save();
      fillRectWithBorder(
        ctx,
        { x: point1_x, y: point1_y },
        { x: point2_x, y: point2_y },
        stopLossBgColor,
        scope.bitmapSize.width
      );

      fillRectWithBorder(
        ctx,
        { x: p1.x < p2.x ? point1_x : point2_x, y: long ? point1_y : point2_y },
        { x: p1.x < p2.x ? point4_x : point1_x, y: long ? pp4_y.position : pp4_y.position + pp4_y.length },
        profitBgColor,
        scope.bitmapSize.width
      );

      if (isHighlighted) {
        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        const riskToReward = Math.abs(p1.price - p4.price) / Math.abs(p1.price - p2.price);
        const middlePosition = horizontalPositions.position + horizontalPositions.length / 2;

        ctx.fillText(
          `RR: ${riskToReward.toFixed(2)}`,
          middlePosition,
          verticalPositions.position + 30 + (long ? 0 : verticalPositions.length)
        );

        ctx.fillText(
          `Target: ${p4.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
          middlePosition,
          long ? pp4_y.position - 25 : pp4_y.position + pp4_y.length + 47
        );

        ctx.fillText(
          `Stop: ${p2.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
          middlePosition,
          long ? point2_y + 25 : point1_y - 13
        );

        ctx.fillStyle = "black";
        drawCircleBody(ctx, { x: p1.x < p2.x ? point1_x : point2_x, y: long ? point1_y : point2_y }, 15, 4);
        drawCircleBody(ctx, { x: p1.x < p2.x ? point2_x : point1_x, y: long ? point2_y : point1_y }, 15, 4);
        drawCircleBody(ctx, { x: p1.x < p2.x ? point2_x : point1_x, y: long ? point1_y : point2_y }, 15, 4);
        drawCircleBody(
          ctx,
          {
            x: p1.x < p2.x ? horizontalPositions.position + horizontalPositions.length : horizontalPositions.position,
            y: long ? pp4_y.position : pp4_y.position + pp4_y.length,
          },
          15,
          4
        );
      }

      ctx.restore();
    });
  }
}

interface ViewPoint {
  x: Coordinate | null;
  y: Coordinate | null;
  price: number;
}

class RectanglePaneView implements ISeriesPrimitivePaneView {
  constructor(private _source: Rectangle, private paneRenderer = new RectanglePaneRenderer()) {}

  update(
    params: {
      hoveringPoint: "p1" | "p2" | "p3" | "p4" | null;
      isHovered: boolean;
      mousePosition: MousePosition | null;
      isSelected: boolean;
    } | null = null
  ) {
    const timeScale = this._source.chart.timeScale();
    const { p1, p2, p3, p4, series, _options } = this._source;

    this.paneRenderer.update({
      p1: { x: timeScale.timeToCoordinate(p1.time), y: series.priceToCoordinate(p1.price), price: p1.price },
      p2: { x: timeScale.timeToCoordinate(p2.time), y: series.priceToCoordinate(p2.price), price: p2.price },
      p3: { x: timeScale.timeToCoordinate(p3.time), y: series.priceToCoordinate(p3.price), price: p3.price },
      p4: { x: timeScale.timeToCoordinate(p4.time), y: series.priceToCoordinate(p4.price), price: p4.price },
      mouse: params?.mousePosition ?? null,
      fillColor: _options.fillColor,
      isHovered: params?.isHovered ?? false,
      hoveringPoint: params?.hoveringPoint ?? null,
      isSelected: params?.isSelected ?? false,
    });
  }

  renderer() {
    return this.paneRenderer;
  }
}

interface Point {
  time: Time;
  price: number;
}

export interface RectangleDrawingToolOptions {
  fillColor: string;
  previewFillColor: string;
  labelColor: string;
  labelTextColor: string;
  showLabels: boolean;
  priceLabelFormatter: (price: number) => string;
  timeLabelFormatter: (time: Time) => string;
}

const defaultOptions: RectangleDrawingToolOptions = {
  fillColor: "rgba(200, 50, 100, 0.75)",
  previewFillColor: "rgba(200, 50, 100, 0.25)",
  labelColor: "rgba(200, 50, 100, 1)",
  labelTextColor: "white",
  showLabels: true,
  priceLabelFormatter: (price: number) => price.toFixed(2),
  timeLabelFormatter: (time: Time) => {
    if (typeof time == "string") return time;
    const date = isBusinessDay(time) ? new Date(time.year, time.month, time.day) : new Date(time * 1000);
    return date.toLocaleDateString();
  },
};

class Rectangle extends PluginBase {
  _options: RectangleDrawingToolOptions;
  _paneViews: RectanglePaneView[];

  constructor(p1: Point, p2: Point, options: Partial<RectangleDrawingToolOptions> = {}) {
    super(p1, p2);
    this._options = { ...defaultOptions, ...options };
    this._paneViews = [new RectanglePaneView(this)];
  }

  updateAllViews() {
    this._paneViews.forEach((pw) =>
      pw.update({
        isHovered: this.isHovered,
        mousePosition: this._mouseEventParams,
        hoveringPoint: this.hoveringPoint,
        isSelected: this.isSelected,
      })
    );
  }

  paneViews() {
    return this._paneViews;
  }

  applyOptions(options: Partial<RectangleDrawingToolOptions>) {
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }
}

class PreviewRectangle extends Rectangle {
  constructor(p1: Point, p2: Point, options: Partial<RectangleDrawingToolOptions> = {}) {
    super(p1, p2, options);
    this._options.fillColor = this._options.previewFillColor;
  }

  public updateEndPoint(p: Point) {
    const profitMargin = Math.abs(this.p1.price - this.p2.price) * 3;
    this.p2 = p;
    this.p3 = { time: this.p2.time, price: this.p1.price };
    this.p4 = { time: this.p2.time, price: this.p1.price + (this.side === "long" ? profitMargin : -profitMargin) };

    this._paneViews[0].update();
    this.requestUpdate();
  }
}

export class RectangleDrawingTool {
  private _chart: IChartApi | undefined;
  private _series: ISeriesApi<SeriesType> | undefined;
  private _drawingsToolbarContainer: HTMLDivElement | undefined;
  private _defaultOptions: Partial<RectangleDrawingToolOptions>;
  private _rectangles: Rectangle[];
  private _previewRectangle: PreviewRectangle | undefined = undefined;
  private _points: Point[] = [];
  private _drawing: boolean = false;
  private _toolbarButton: HTMLDivElement | undefined;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    drawingsToolbarContainer: HTMLDivElement,
    options: Partial<RectangleDrawingToolOptions>
  ) {
    this._chart = chart;
    this._series = series;
    this._drawingsToolbarContainer = drawingsToolbarContainer;
    console.log("init");
    this._addToolbarButton();
    this._defaultOptions = options;
    this._rectangles = [];
    this._chart.subscribeClick(this._onClick);
    this._chart.subscribeCrosshairMove(this._moveHandler);
    document.addEventListener("keydown", this.keyDownListener, false);
  }

  private keyDownListener = (event: KeyboardEvent) => {
    switch (event.key) {
      case "Escape":
        this.stopDrawing();
        this._removePreviewRectangle();
        break;
      case "Backspace":
        this._rectangles.forEach((rectangle) => {
          if (rectangle.isSelected) {
            this._removeRectangle(this._rectangles[this._rectangles.length - 1]);
            this._rectangles.pop();
          }
        });
        this._series?.applyOptions({}); // Triggers update to completely remove the primitive

        break;
    }
  };

  private _clickHandler = (param: MouseEventParams) => this._onClick(param);
  private _moveHandler = (param: MouseEventParams) => this._onMouseMove(param);

  remove() {
    console.log("remove");
    this.stopDrawing();
    this._chart?.unsubscribeClick(this._clickHandler);
    this._chart?.unsubscribeCrosshairMove(this._moveHandler);
    this._rectangles.forEach((rectangle) => {
      this._removeRectangle(rectangle);
    });

    this._rectangles = [];
    this._removePreviewRectangle();
    this._chart = undefined;
    this._series = undefined;
    this._drawingsToolbarContainer = undefined;
    this._toolbarButton = undefined;
    document.removeEventListener("keydown", this.keyDownListener, false);
  }

  startDrawing = (): void => {
    this._drawing = true;

    this._points = [];
    if (this._toolbarButton) {
      this._toolbarButton.style.fill = "rgb(100, 150, 250)";
    }
  };

  stopDrawing(): void {
    console.log("stop drawing");
    this._drawing = false;
    this._points = [];
    if (this._toolbarButton) {
      this._toolbarButton.style.fill = "rgb(255, 255, 255)";
    }
  }

  isDrawing(): boolean {
    return this._drawing;
  }

  private _onClick = (param: MouseEventParams) => {
    // this._rectangles.forEach((rectangle) => {
    //   console.log(rectangle._p1.price, rectangle._p2.price);
    // });
    console.log("drawing", !this._drawing, !param.point, !param.time, !this._series);
    if (!this.isDrawing() || !param.point || !param.time || !this._series) return;
    console.log("click 2");
    // console.log("on click");
    const price = this._series.coordinateToPrice(param.point.y);
    if (price === null) {
      return;
    }
    this._addPoint({ time: param.time, price });
  };

  private _onMouseMove = (param: MouseEventParams) => {
    if (!this._drawing || !param.point || !param.time || !this._series) return;

    const price = this._series.coordinateToPrice(param.point.y);
    if (price === null) return;

    this._previewRectangle?.updateEndPoint({ time: param.time, price });
  };

  private _addPoint(p: Point) {
    console.log("add point");
    this._points.push(p);
    if (this._points.length >= 2) {
      this._addNewRectangle(this._points[0], this._points[1]);

      this.stopDrawing();
      this._removePreviewRectangle();
    }
    if (this._points.length === 1) {
      this._addPreviewRectangle(this._points[0]);
    }
  }

  private _addNewRectangle(p1: Point, p2: Point) {
    const rectangle = new Rectangle(p1, p2, { ...this._defaultOptions });
    this._rectangles.push(rectangle);
    console.log("rectangle added");
    // rectangle.hitTest()
    ensureDefined(this._series).attachPrimitive(rectangle);
  }

  //   private addPrice() {
  //     const priceElement = document.createElement("div");
  //     applyStyle(priceElement, { "font-size": "14px", "line-height": "18px", "font-weight": "590", color: "red" });

  //     this.priceElement = priceElement;
  //     this._drawingsToolbarContainer?.appendChild(priceElement);
  //   }

  private _removeRectangle(rectangle: Rectangle) {
    console.log("remove");
    ensureDefined(this._series).detachPrimitive(rectangle);
  }

  private _addPreviewRectangle(p: Point) {
    this._previewRectangle = new PreviewRectangle(p, p, { ...this._defaultOptions });
    ensureDefined(this._series).attachPrimitive(this._previewRectangle);
  }

  private _removePreviewRectangle() {
    if (this._previewRectangle) {
      ensureDefined(this._series).detachPrimitive(this._previewRectangle);
      this._previewRectangle = undefined;
      this._series?.applyOptions({}); // Triggers update to completely remove the primitive
    }
  }

  private _addToolbarButton() {
    console.log("create divs");
    if (!this._drawingsToolbarContainer || this._toolbarButton) return;
    const button = document.createElement("div");
    button.style.width = "20px";
    button.style.height = "20px";
    button.style.fill = "rgb(255, 255, 255)";
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2 6.5A2.5 2.5 0 0 1 6.95 6H24v1H6.95A2.5 2.5 0 0 1 2 6.5zM4.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2 16.5a2.5 2.5 0 0 1 4.95-.5h13.1a2.5 2.5 0 1 1 0 1H6.95A2.5 2.5 0 0 1 2 16.5zM22.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-18 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2 22.5a2.5 2.5 0 0 1 4.95-.5H24v1H6.95A2.5 2.5 0 0 1 2 22.5z"></path><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M22.4 8.94l-1.39.63-.41-.91 1.39-.63.41.91zm-4 1.8l-1.39.63-.41-.91 1.39-.63.41.91zm-4 1.8l-1.4.63-.4-.91 1.39-.63.41.91zm-4 1.8l-1.4.63-.4-.91 1.39-.63.41.91z"></path></svg>`; // `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="none"><path fill="white" fill-rule="evenodd" clip-rule="evenodd" d="M4.5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2 6.5A2.5 2.5 0 0 1 6.95 6H24v1H6.95A2.5 2.5 0 0 1 2 6.5zM4.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2 16.5a2.5 2.5 0 0 1 4.95-.5h13.1a2.5 2.5 0 1 1 0 1H6.95A2.5 2.5 0 0 1 2 16.5zM22.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-18 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2 22.5a2.5 2.5 0 0 1 4.95-.5H24v1H6.95A2.5 2.5 0 0 1 2 22.5z"></path><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M22.4 8.94l-1.39.63-.41-.91 1.39-.63.41.91zm-4 1.8l-1.39.63-.41-.91 1.39-.63.41.91zm-4 1.8l-1.4.63-.4-.91 1.39-.63.41.91zm-4 1.8l-1.4.63-.4-.91 1.39-.63.41.91z"></path></svg>`; //`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M315.4 15.5C309.7 5.9 299.2 0 288 0s-21.7 5.9-27.4 15.5l-96 160c-5.9 9.9-6.1 22.2-.4 32.2s16.3 16.2 27.8 16.2H384c11.5 0 22.2-6.2 27.8-16.2s5.5-22.3-.4-32.2l-96-160zM288 312V456c0 22.1 17.9 40 40 40H472c22.1 0 40-17.9 40-40V312c0-22.1-17.9-40-40-40H328c-22.1 0-40 17.9-40 40zM128 512a128 128 0 1 0 0-256 128 128 0 1 0 0 256z"/></svg>`;
    button.addEventListener("click", () => {
      console.log("ckic");
      if (this.isDrawing()) this.stopDrawing();
      else this.startDrawing();
    });
    this._drawingsToolbarContainer.appendChild(button);
    this._toolbarButton = button;
  }
}
