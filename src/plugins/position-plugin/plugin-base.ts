import {
  DataChangedScope,
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesOptionsMap,
  Time,
} from "lightweight-charts";
import { ensureDefined } from "../utils/assertions";
import { MouseHandlers, MousePosition } from "../utils/mouse";
import { arePointsClose } from "../utils/draw";

interface Point {
  time: Time;
  price: number;
}

type Series = ISeriesPrimitive<Time> & { p1: Point; p2: Point };

export abstract class PluginBase implements Series {
  private _chart: IChartApi | undefined = undefined;
  private _series: ISeriesApi<keyof SeriesOptionsMap> | undefined = undefined;
  public _mouseEventParams: MousePosition | null = null;
  public startingDragPosition: MousePosition | null = null;
  private _mouseHandlers = new MouseHandlers();
  protected isHovered = false;
  protected isDragging = false;
  protected isSelected = false;
  protected hoveringPoint: "p1" | "p2" | "p3" | "p4" | null = null;
  protected draggingPoint: "p1" | "p2" | "p3" | "p4" | null = null;
  public p3: Point;
  public p4: Point;

  protected constructor(public p1: Point, public p2: Point) {
    this.p3 = { time: p2.time, price: p1.price };

    const profitMargin = Math.abs(this.p1.price - this.p2.price) * 3;
    this.p4 = { time: this.p2.time, price: this.p1.price + (this.side === "long" ? profitMargin : -profitMargin) };
  }

  protected dataUpdated?(scope: DataChangedScope): void;
  protected requestUpdate(): void {
    this._requestUpdate?.();
  }
  private _requestUpdate?: () => void;

  protected get side(): "long" | "short" {
    return this.p1.price >= this.p2.price ? "long" : "short";
  }

  public attached = ({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) => {
    this._chart = chart;
    this._series = series;
    this._series.subscribeDataChanged(this._fireDataUpdated);

    this._mouseHandlers.attached(chart, series);
    this._mouseHandlers.clicked().subscribe((mousePosition) => {
      console.log("clicked");
      this._mouseEventParams = mousePosition;
      this.isSelected = this.isInside(mousePosition);
      requestUpdate();
    }, this);

    this._mouseHandlers.mouseMoved().subscribe((mousePosition) => {
      this._mouseEventParams = mousePosition;
      if (!this.isDragging && mousePosition) {
        this.hoveringPoint = this.closeToPoint(mousePosition);
        this.isHovered = this.isInside(mousePosition) || this.hoveringPoint !== null;
      }
      requestUpdate();
    }, this);

    this._mouseHandlers.dragStarted().subscribe((mousePosition) => {
      this.isDragging = true;
      this.draggingPoint = this.closeToPoint(mousePosition);
      this.startingDragPosition = mousePosition;
    }, this);

    this._mouseHandlers.dragEnded().subscribe(() => {
      this.isDragging = false;
      this.draggingPoint = null;
      this.startingDragPosition = null;
      this._chart?.applyOptions({ handleScale: true, handleScroll: true });
    }, this);

    this._mouseHandlers.dragging().subscribe((mousePosition) => {
      if (mousePosition && this.isDragging && this.isHovered && !this.hoveringPoint && this.startingDragPosition) {
        this._chart?.applyOptions({ handleScale: false, handleScroll: false });
        const timeScale = this._chart?.timeScale();
        const time = timeScale?.coordinateToTime(mousePosition.x) as number;
        const price = this._series?.coordinateToPrice(mousePosition.y);
        const startingTime = timeScale?.coordinateToTime(this.startingDragPosition.x) as number;
        const startingPrice = this._series?.coordinateToPrice(this.startingDragPosition.y);
        const xDiff = mousePosition.x - this.startingDragPosition.x;
        const yDiff = mousePosition.y - this.startingDragPosition.y;
        if (price && startingPrice) {
          let timeDiff = time && startingTime ? time - startingTime : 0;

          const isOutsideBounds =
            !timeScale?.timeToCoordinate(((this.p1.time as number) + timeDiff) as Time) ||
            !timeScale?.timeToCoordinate(((this.p2.time as number) + timeDiff) as Time);

          if (isOutsideBounds) timeDiff = 0;

          (this.p1.time as number) += timeDiff as number;
          (this.p2.time as number) += timeDiff as number;
          (this.p3.time as number) += timeDiff as number;
          (this.p4.time as number) += timeDiff as number;

          const priceDiff = price - startingPrice - ((price - startingPrice) % 0.01);
          this.p1.price += priceDiff;
          this.p2.price += priceDiff;
          this.p3.price += priceDiff;
          this.p4.price += priceDiff;

          this.startingDragPosition.x += xDiff;
          this.startingDragPosition.y += yDiff;
          return;
        }
      }

      if (mousePosition && this.hoveringPoint && this.isDragging) {
        this._chart?.applyOptions({ handleScale: false, handleScroll: false });

        const minMove = this._series?.options().priceFormat.minMove ?? 0;
        const currentEntryPrice = this.p1.price;
        const currentStopPrice = this.p2.price;
        const currentProfitPrice = this.p4.price;
        const time = this._chart?.timeScale().coordinateToTime(mousePosition.x);
        const price = this._series?.coordinateToPrice(mousePosition.y);

        switch (this.hoveringPoint) {
          case "p1": {
            if (time) this.p1.time = time;
            break;
          }
          case "p2": {
            if (price)
              this.p2.price =
                this.side === "long"
                  ? Math.min(price, currentEntryPrice - minMove)
                  : Math.max(price, currentEntryPrice + minMove);
            break;
          }
          case "p3": {
            if (price) {
              const isOutsideBounds = !time;
              this.p1.price = this.p3.price;
              if (!isOutsideBounds) {
                this.p2.time = time;
                this.p4.time = time;
                this.p3.time = time;
              }

              this.p3.price =
                this.side === "long"
                  ? Math.min(Math.max(price, currentStopPrice + minMove), currentProfitPrice - minMove)
                  : Math.min(Math.max(price, currentProfitPrice + minMove), currentStopPrice - minMove);
            }
            break;
          }
          case "p4": {
            if (price)
              this.p4.price =
                this.side === "long"
                  ? Math.max(price, currentEntryPrice + minMove)
                  : Math.min(price, currentEntryPrice - minMove);
            break;
          }
        }
        this.requestUpdate();
      }
    }, this);

    this._requestUpdate = requestUpdate;
    this.requestUpdate();
  };

  private closeToPoint(mousePosition: MousePosition | null): "p1" | "p2" | "p3" | "p4" | null {
    if (!mousePosition) return null;
    return arePointsClose(mousePosition, this.pointToCoord(this.p1), 5)
      ? "p1"
      : arePointsClose(mousePosition, this.pointToCoord(this.p2), 5)
      ? "p2"
      : arePointsClose(mousePosition, this.pointToCoord(this.p3), 5)
      ? "p3"
      : arePointsClose(mousePosition, this.pointToCoord(this.p4), 5)
      ? "p4"
      : null;
  }

  private pointToCoord = (point: Point) => {
    const x = this._chart?.timeScale().timeToCoordinate(point.time) as number;
    const y = this._series?.priceToCoordinate(point.price) as number;
    return { x, y };
  };

  private isInside = (mousePosition: MousePosition | null) => {
    if (mousePosition) {
      const mouseTime = this._chart?.timeScale().coordinateToTime(mousePosition.x) as number;
      const mousePrice = this._series?.coordinateToPrice(mousePosition.y);

      if (mouseTime && mousePrice) {
        const { p1, p2, p4 } = this;
        const startTime = Math.min(p1.time as number, p2.time as number);
        const endTime = Math.max(p1.time as number, p2.time as number);
        const startPrice = Math.min(p1.price, p2.price, p4.price);
        const endPrice = Math.max(p4.price, p2.price, p4.price);
        return (
          mouseTime >= startTime && //
          mouseTime <= endTime &&
          mousePrice >= startPrice &&
          mousePrice <= endPrice
        );
      }
    }
    return false;
  };
  //   updateAllViews(): void {
  //     console.log("ypdate all view");
  //   }

  public detached() {
    console.log("detached");
    this._series?.unsubscribeDataChanged(this._fireDataUpdated);
    this._mouseHandlers.mouseMoved().unsubscribeAll(this);
    this._mouseHandlers.clicked().unsubscribeAll(this);
    this._mouseHandlers.dragStarted().unsubscribeAll(this);
    this._mouseHandlers.dragging().unsubscribeAll(this);
    this._mouseHandlers.dragEnded().unsubscribeAll(this);
    this._mouseHandlers.detached();
    this._chart = undefined;
    this._series = undefined;
    this._requestUpdate = undefined;
  }

  public get chart(): IChartApi {
    return ensureDefined(this._chart);
  }

  public get series(): ISeriesApi<keyof SeriesOptionsMap> {
    return ensureDefined(this._series);
  }

  // This method is a class property to maintain the
  // lexical 'this' scope (due to the use of the arrow function)
  // and to ensure its reference stays the same, so we can unsubscribe later.
  private _fireDataUpdated = (scope: DataChangedScope) => {
    this.dataUpdated?.(scope);
  };
}
