import type { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
import { Delegate, ISubscription } from "./delegate";

export interface MousePosition {
  x: number;
  y: number;
}

type UnSubscriber = () => void;

export class MouseHandlers {
  _chart: IChartApi | undefined = undefined;
  _series: ISeriesApi<SeriesType> | undefined = undefined;
  _unSubscribers: UnSubscriber[] = [];

  private _clicked: Delegate<MousePosition | null> = new Delegate();
  private _down: Delegate<MousePosition | null> = new Delegate();
  private _up: Delegate<MousePosition | null> = new Delegate();
  private _mouseMoved: Delegate<MousePosition | null> = new Delegate();

  attached(chart: IChartApi, series: ISeriesApi<SeriesType>) {
    this._chart = chart;
    this._series = series;
    const container = this._chart.chartElement();
    this._addMouseEventListener(container, "mouseleave", this._mouseLeave);
    this._addMouseEventListener(container, "mousemove", this._mouseMove);
    this._addMouseEventListener(container, "mousedown", this._mouseDown);
    this._addMouseEventListener(container, "mouseup", this._mouseUp);
  }

  detached() {
    this._series = undefined;
    this._clicked.destroy();
    this._down.destroy();
    this._up.destroy();
    this._mouseMoved.destroy();
    this._unSubscribers.forEach((unSub) => {
      unSub();
    });
    this._unSubscribers = [];
  }

  public clicked(): ISubscription<MousePosition | null> {
    return this._down;
  }

  public mouseMoved(): ISubscription<MousePosition | null> {
    return this._mouseMoved;
  }

  public dragStarted(): ISubscription<MousePosition | null> {
    return this._down;
  }

  public dragging(): ISubscription<MousePosition | null> {
    return this._mouseMoved;
  }

  public dragEnded(): ISubscription<MousePosition | null> {
    return this._up;
  }

  _addMouseEventListener(
    target: HTMLDivElement,
    eventType: "mouseleave" | "mousemove" | "mousedown" | "mouseup",
    handler: (event: MouseEvent) => void
  ): void {
    const boundMouseMoveHandler = handler.bind(this);
    target.addEventListener(eventType, boundMouseMoveHandler);
    const unSubscriber = () => {
      target.removeEventListener(eventType, boundMouseMoveHandler);
    };
    this._unSubscribers.push(unSubscriber);
  }

  _mouseLeave() {
    this._mouseMoved.fire(null);
  }

  _mouseMove(event: MouseEvent) {
    this._mouseMoved.fire(this._determineMousePosition(event));
  }

  _mouseDown(event: MouseEvent) {
    this._down.fire(this._determineMousePosition(event));
  }

  _mouseUp(event: MouseEvent) {
    this._up.fire(this._determineMousePosition(event));
  }

  _determineMousePosition(event: MouseEvent): MousePosition | null {
    if (!this._chart || !this._series) return null;
    const element = this._chart.chartElement();
    const chartContainerBox = element.getBoundingClientRect();
    const x = event.clientX - chartContainerBox.x;
    const y = event.clientY - chartContainerBox.y;
    return { x, y };
  }
}
