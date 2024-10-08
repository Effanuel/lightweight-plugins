import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitivePaneView,
  MouseEventParams,
  SeriesType,
  Time,
} from "lightweight-charts";
import { ensureDefined } from "../utils/assertions";
import { PluginBase } from "./plugin-base";
import type { MousePosition } from "../utils/mouse";
import RectanglePaneRenderer from "./pane-renderer";
import { round } from "@/utils";

class RectanglePaneView implements ISeriesPrimitivePaneView {
  private paneRenderer = new RectanglePaneRenderer();

  constructor(private _source: Rectangle) {}

  update(
    params: {
      hoveringPoint: "p1" | "p2" | "p3" | "p4" | null;
      isHovered: boolean;
      mousePosition: MousePosition | null;
      isSelected: boolean;
    } | null = null
  ) {
    const { p1, p2, p3, p4, series } = this._source;
    const timeScale = this._source.chart.timeScale();

    this.paneRenderer.update({
      p1: { x: timeScale.timeToCoordinate(p1.time), y: series.priceToCoordinate(p1.price), price: p1.price },
      p2: { x: timeScale.timeToCoordinate(p2.time), y: series.priceToCoordinate(p2.price), price: p2.price },
      p3: { x: timeScale.timeToCoordinate(p3.time), y: series.priceToCoordinate(p3.price), price: p3.price },
      p4: { x: timeScale.timeToCoordinate(p4.time), y: series.priceToCoordinate(p4.price), price: p4.price },
      mouse: params?.mousePosition ?? null,
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

class Rectangle extends PluginBase {
  _paneViews: RectanglePaneView[];

  constructor(p1: Point, p2: Point) {
    super(p1, p2);
    this._paneViews = [new RectanglePaneView(this)];
  }

  updateAllViews() {
    this._paneViews.forEach((pw) =>
      pw.update({
        isHovered: this.isHovered,
        mousePosition: this._mousePosition,
        hoveringPoint: this.hoveringPoint,
        isSelected: this.isSelected,
      })
    );
  }

  paneViews() {
    return this._paneViews;
  }
}

class PreviewRectangle extends Rectangle {
  public updateEndPoint(p: Point) {
    const profitMargin = Math.abs(this.p1.price - this.p2.price) * 3;
    this.p2 = p;
    this.p3 = { time: this.p2.time, price: this.p1.price };
    this.p4 = { time: this.p2.time, price: this.p1.price + (this.side === "long" ? profitMargin : -profitMargin) };

    this._paneViews[0].update();
    this.requestUpdate();
  }
}

interface Options {
  onSubmit?: (entry: number, stop: number, target: number) => void;
}

export class PositionPluginTool {
  private _chart: IChartApi | undefined;
  private _series: ISeriesApi<SeriesType> | undefined;
  private drawingsToolbarContainer: HTMLDivElement | undefined;
  private rectangle: Rectangle | null = null;
  private previewRectangle: PreviewRectangle | null = null;
  private points: Point[] = [];
  private drawing = false;
  private toolbarButton: HTMLDivElement | undefined;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    drawingsToolbarContainer: HTMLDivElement,
    private options?: Options
  ) {
    this._chart = chart;
    this._series = series;
    this.drawingsToolbarContainer = drawingsToolbarContainer;
    this.addToolbarButton();
    this._chart.subscribeClick(this._onClick);
    this._chart.subscribeCrosshairMove(this._moveHandler);
    document.addEventListener("keydown", this.keyDownListener, false);
  }

  private keyDownListener = (event: KeyboardEvent) => {
    switch (event.key) {
      case "Escape":
        this.stopDrawing();
        this.removePreviewRectangle();
        break;
      case "Backspace":
        if (this.rectangle?.isSelected) {
          this.removeRectangle();
        }
        break;
      case "Enter":
        if (this.rectangle?.isSelected) {
          const minMove = this._series?.options().priceFormat.minMove ?? 0.00001; // Bugs will occur with minMove = 0
          const entry = round(this.rectangle.p1.price, minMove);
          const stop = round(this.rectangle.p2.price, minMove);
          const target = round(this.rectangle.p4.price, minMove);
          this.options?.onSubmit?.(entry, stop, target);
        }
        break;
    }
  };

  private _clickHandler = (param: MouseEventParams) => this._onClick(param);
  private _moveHandler = (param: MouseEventParams) => this._onMouseMove(param);

  remove() {
    this.stopDrawing();
    this._chart?.unsubscribeClick(this._clickHandler);
    this._chart?.unsubscribeCrosshairMove(this._moveHandler);
    this.removeRectangle();
    this.removePreviewRectangle();
    this._chart = undefined;
    this._series = undefined;
    this.drawingsToolbarContainer = undefined;
    this.toolbarButton = undefined;
    document.removeEventListener("keydown", this.keyDownListener, false);
  }

  startDrawing = (): void => {
    this.removeRectangle();
    this.drawing = true;
    this.points = [];
    if (this.toolbarButton) {
      this.toolbarButton.style.fill = "rgb(100, 150, 250)";
    }
  };

  stopDrawing(): void {
    this.drawing = false;
    this.points = [];
    if (this.toolbarButton) {
      this.toolbarButton.style.fill = "rgb(255, 255, 255)";
    }
  }

  private _onClick = (param: MouseEventParams) => {
    if (!this.drawing || !param.point || !param.time || !this._series) return;
    const price = this._series.coordinateToPrice(param.point.y);
    if (price === null) {
      return;
    }
    this._addPoint({ time: param.time, price });
  };

  private _onMouseMove = (param: MouseEventParams) => {
    if (!this.drawing || !param.point || !param.time || !this._series) return;

    const price = this._series.coordinateToPrice(param.point.y);
    if (price === null) return;

    this.previewRectangle?.updateEndPoint({ time: param.time, price });
  };

  private _addPoint(p: Point) {
    this.points.push(p);
    if (this.points.length >= 2) {
      this.addNewRectangle(this.points[0], this.points[1]);

      this.stopDrawing();
      this.removePreviewRectangle();
    }
    if (this.points.length === 1) {
      this.addPreviewRectangle(this.points[0]);
    }
  }

  private addNewRectangle(p1: Point, p2: Point) {
    const rectangle = new Rectangle(p1, p2);
    this.rectangle = rectangle;
    // rectangle.hitTest()
    ensureDefined(this._series).attachPrimitive(rectangle);
  }

  private removeRectangle() {
    if (this.rectangle) {
      ensureDefined(this._series).detachPrimitive(this.rectangle);
      this.rectangle = null;
      this._series?.applyOptions({}); // Triggers update to completely remove the primitive
    }
  }

  private addPreviewRectangle(p: Point) {
    this.previewRectangle = new PreviewRectangle(p, p);
    ensureDefined(this._series).attachPrimitive(this.previewRectangle);
  }

  private removePreviewRectangle() {
    if (this.previewRectangle) {
      ensureDefined(this._series).detachPrimitive(this.previewRectangle);
      this.previewRectangle = null;
      this._series?.applyOptions({}); // Triggers update to completely remove the primitive
    }
  }

  private addToolbarButton() {
    if (!this.drawingsToolbarContainer || this.toolbarButton) return;
    const button = document.createElement("div");
    button.style.width = "20px";
    button.style.height = "20px";
    button.style.fill = "rgb(255, 255, 255)";
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2 6.5A2.5 2.5 0 0 1 6.95 6H24v1H6.95A2.5 2.5 0 0 1 2 6.5zM4.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2 16.5a2.5 2.5 0 0 1 4.95-.5h13.1a2.5 2.5 0 1 1 0 1H6.95A2.5 2.5 0 0 1 2 16.5zM22.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-18 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2 22.5a2.5 2.5 0 0 1 4.95-.5H24v1H6.95A2.5 2.5 0 0 1 2 22.5z"></path><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M22.4 8.94l-1.39.63-.41-.91 1.39-.63.41.91zm-4 1.8l-1.39.63-.41-.91 1.39-.63.41.91zm-4 1.8l-1.4.63-.4-.91 1.39-.63.41.91zm-4 1.8l-1.4.63-.4-.91 1.39-.63.41.91z"></path></svg>`;
    button.addEventListener("click", () => {
      if (this.drawing) this.stopDrawing();
      else this.startDrawing();
    });
    this.drawingsToolbarContainer.appendChild(button);
    this.toolbarButton = button;
  }
}
