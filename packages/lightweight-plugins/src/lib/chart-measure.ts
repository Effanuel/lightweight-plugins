import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";

type Bar = { time: number };

/** What chart-measure resolves times and measurements against, per chart. */
export type ChartEnv = { getBars(): readonly Bar[]; tickSize(): number };

const chartEnvs = new WeakMap<IChartApi, ChartEnv>();

/** Registered by DrawingManager for its chart. Returns the unregister function. */
export function registerChartEnv(chart: IChartApi, env: ChartEnv): () => void {
  chartEnvs.set(chart, env);
  return () => {
    if (chartEnvs.get(chart) === env) chartEnvs.delete(chart);
  };
}

function getPriceBars(chart: IChartApi): readonly Bar[] {
  return chartEnvs.get(chart)?.getBars() ?? [];
}

export type MeasurePoint = {
  price: number;
  time: number;
};

export type MeasurementData = {
  start: MeasurePoint;
  end: MeasurePoint;
  priceDiff: number;
  pctChange: number;
  points: number;
  bars: number;
  days: number;
  tickSize: number;
};

export function getChartPaneCoords(e: MouseEvent, container: HTMLDivElement) {
  const rect = container.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

/** The only thing the drawing layer needs off a series: the two price↔pixel maps. */
export type PriceConverter = {
  priceToCoordinate(price: number): number | null;
  coordinateToPrice(coordinate: number): number | null;
};

// The custom series sharing a pane with `forSeries` — the footprint bars in
// range mode for the price pane. Picked by type rather than position: the
// volume histogram shares the pane on its own scale and would answer prices
// from the wrong one. Scoped to the SAME pane, never pane 0 by default: a
// CVD-attached primitive must not fall back to footprint prices.
function paneCustomSeries(chart: IChartApi, forSeries: PriceConverter): ISeriesApi<SeriesType, Time> | null {
  // lightweight-charts adds a series to its pane BEFORE registering the API
  // wrapper getSeries() maps it through (ensureDefined → "Value is undefined"),
  // and that add synchronously runs every primitive's update — which is when
  // a range pane's order/position primitives land here. Answer null for that
  // instant; the next update (the series' own setData) sees the wrapper.
  let series: ISeriesApi<SeriesType, Time>[];
  try {
    const panes = chart.panes();
    const own = panes.find((p) => p.getSeries().includes(forSeries as ISeriesApi<SeriesType, Time>));
    series = (own ?? panes[0])?.getSeries() ?? [];
  } catch {
    return null;
  }
  return series.find((s) => s.seriesType() === "Custom") ?? null;
}

/**
 * The price pane's data-bearing series, for callers that need a REAL series
 * (setCrosshairPosition takes one). In range mode the candlestick series is
 * deliberately empty and the footprint custom series carries the bars on the
 * same price scale; an empty series answers null from both price↔coordinate
 * directions (lightweight-charts needs its own firstValue). Same reasoning as
 * useChartSync's crosshairView.
 */
export function priceScaleSeries<T extends PriceConverter>(
  chart: IChartApi,
  series: T,
): T | ISeriesApi<SeriesType, Time> {
  if (series.coordinateToPrice(0) != null) return series;
  return paneCustomSeries(chart, series) ?? series;
}

/**
 * Price↔pixel that survives range mode, resolved per call — the footprint
 * series mounts AFTER the plugins do and comes and goes with the interval, so
 * a converter captured at attach time would miss it. Costs nothing in time
 * mode: the candlestick series answers and the fallback never runs.
 */
export function priceConverter(chart: IChartApi, series: PriceConverter): PriceConverter {
  return {
    priceToCoordinate: (price) =>
      series.priceToCoordinate(price) ?? paneCustomSeries(chart, series)?.priceToCoordinate(price) ?? null,
    coordinateToPrice: (coordinate) =>
      series.coordinateToPrice(coordinate) ??
      paneCustomSeries(chart, series)?.coordinateToPrice(coordinate) ??
      null,
  };
}

export function priceAtY(series: PriceConverter, y: number): number | null {
  return series.coordinateToPrice(y);
}

/**
 * The nearest multiple of tickSize — an instrument trades nowhere else, so no
 * price sampled off the cursor may land between ticks. Re-rounded to the
 * tick's own decimals to shed float error (0.1 * 3 issues). Non-positive tick
 * (unknown instrument) passes the price through.
 */
export function snapToTick(price: number, tickSize: number): number {
  if (!(tickSize > 0)) return price;
  return Number((Math.round(price / tickSize) * tickSize).toFixed(10));
}

export function timeAtX(chart: IChartApi, x: number): number | null {
  const logical = chart.timeScale().coordinateToLogical(x);
  if (logical == null) return null;
  const bars = getPriceBars(chart);
  if (bars.length < 2) return null;
  const idx = Math.round(logical);

  // Within data range
  if (idx >= 0 && idx < bars.length) return bars[idx].time;

  // Extrapolate using bar interval
  const interval = bars[bars.length - 1].time - bars[bars.length - 2].time;

  if (idx >= bars.length) {
    // Beyond last candle — project forward
    return bars[bars.length - 1].time + (idx - bars.length + 1) * interval;
  }

  // Before first candle — project backward
  return bars[0].time + idx * interval;
}

/**
 * Convert a timestamp to a chart x-coordinate.
 * Falls back to interpolation via logical coordinates when the exact time
 * doesn't exist in the current timeframe data.
 */
export function timeToCoordinateOrNearest(chart: IChartApi, time: number): number | null {
  const ts = chart.timeScale();
  const direct = ts.timeToCoordinate(time as unknown as Time);
  if (direct != null) return direct;

  // Exact time not in current data — interpolate using two known bars
  const bars = getPriceBars(chart);
  if (bars.length < 2) return null;

  const first = bars[0];
  const last = bars[bars.length - 1];

  // If the target time is outside the data range, find the edge coordinate
  if (time <= first.time) {
    const firstCoord = ts.timeToCoordinate(first.time as unknown as Time);
    if (firstCoord == null) return null;
    // Extrapolate backwards using the bar spacing
    const secondCoord = ts.timeToCoordinate(bars[1].time as unknown as Time);
    if (secondCoord == null) return firstCoord;
    const pixelsPerSecond = (secondCoord - firstCoord) / (bars[1].time - first.time);
    return firstCoord + pixelsPerSecond * (time - first.time);
  }

  if (time >= last.time) {
    const lastCoord = ts.timeToCoordinate(last.time as unknown as Time);
    if (lastCoord == null) return null;
    const prevCoord = ts.timeToCoordinate(bars[bars.length - 2].time as unknown as Time);
    if (prevCoord == null) return lastCoord;
    const pixelsPerSecond = (lastCoord - prevCoord) / (last.time - bars[bars.length - 2].time);
    return lastCoord + pixelsPerSecond * (time - last.time);
  }

  // Time is within range — binary search for the containing (floor) bar
  let lo = 0;
  let hi = bars.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].time <= time) lo = mid;
    else hi = mid;
  }

  // Snap to the floor bar's center — this is the bar whose interval contains the target time
  const loCoord = ts.timeToCoordinate(bars[lo].time as unknown as Time);
  if (loCoord != null) return loCoord;

  // Floor bar not in chart series — search outward for two anchors and interpolate
  let leftCoord: number | null = null;
  let leftTime = 0;
  for (let i = lo - 1; i >= 0; i--) {
    const c = ts.timeToCoordinate(bars[i].time as unknown as Time);
    if (c != null) { leftCoord = c; leftTime = bars[i].time; break; }
  }
  let rightCoord: number | null = null;
  let rightTime = 0;
  for (let i = hi; i < bars.length; i++) {
    const c = ts.timeToCoordinate(bars[i].time as unknown as Time);
    if (c != null) { rightCoord = c; rightTime = bars[i].time; break; }
  }

  if (leftCoord != null && rightCoord != null && rightTime !== leftTime) {
    const fraction = (time - leftTime) / (rightTime - leftTime);
    return leftCoord + fraction * (rightCoord - leftCoord);
  }

  return leftCoord ?? rightCoord;
}

/** A chart-space point identified by its bar time and price. */
export type TimePricePoint = {
  time: number;
  price: number;
};

/** A pixel-space point in the chart pane's coordinate system. */
export type PixelPoint = {
  x: number;
  y: number;
};

/**
 * Minimal structural series type for projection: just price→coordinate.
 * Accepts any concrete `ISeriesApi<...>` the drawing primitives hold without
 * forcing them to narrow to the "Candlestick" generic.
 */
export type PriceProjectable = {
  priceToCoordinate: (price: number) => number | null;
};

/**
 * Project a { time, price } point to pixel { x, y } in the chart pane's space.
 *
 * Uses `timeToCoordinateOrNearest` (nearest-bar fallback) for x and the series'
 * `priceToCoordinate` for y. Returns null when either coordinate is unresolvable,
 * centralizing the null-guard that was duplicated across every drawing primitive's
 * `update()`, hit-tests, and `getEnclosedIds()`.
 */
export function projectPoint(
  chart: IChartApi,
  series: PriceProjectable,
  point: TimePricePoint,
): PixelPoint | null {
  const x = timeToCoordinateOrNearest(chart, point.time);
  if (x == null) return null;
  const y = series.priceToCoordinate(point.price);
  if (y == null) return null;
  return { x, y };
}

/**
 * Project a list of { time, price } points. By default any point that fails to
 * project is skipped (matching the path/building-points behavior). Pass
 * `{ skipNull: false }` to abort and return null if ANY point fails to project
 * (matching the box/fib all-or-nothing behavior).
 */
export function projectPoints(
  chart: IChartApi,
  series: PriceProjectable,
  points: readonly TimePricePoint[],
  opts: { skipNull?: boolean } = {},
): PixelPoint[] | null {
  const skipNull = opts.skipNull ?? true;
  const out: PixelPoint[] = [];
  for (const pt of points) {
    const projected = projectPoint(chart, series, pt);
    if (projected == null) {
      if (skipNull) continue;
      return null;
    }
    out.push(projected);
  }
  return out;
}

export function computeMeasurement(chart: IChartApi, start: MeasurePoint, end: MeasurePoint): MeasurementData {
  const env = chartEnvs.get(chart);
  const barsData = env?.getBars() ?? [];
  const tickSize = env?.tickSize() ?? 0.01;

  const priceDiff = end.price - start.price;
  const pctChange = start.price !== 0 ? (priceDiff / start.price) * 100 : 0;
  const points = priceDiff / tickSize;

  const barInterval = barsData.length >= 2
    ? barsData[barsData.length - 1].time - barsData[barsData.length - 2].time
    : 1;
  const bars = barInterval > 0 ? Math.round(Math.abs(end.time - start.time) / barInterval) : 0;
  const days = Math.abs(end.time - start.time) / 86400;

  return { start, end, priceDiff, pctChange, points, bars, days: Math.round(days), tickSize };
}
