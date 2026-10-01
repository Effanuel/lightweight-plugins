import type { ChartPluginContext } from "./chart-plugin";
import type { ChartGeometry } from "./chart-gesture";
import { priceAtY, snapToTick, timeAtX } from "../lib/chart-measure";

/**
 * The sample a drawing-tool drag carries. Fields are individually nullable and
 * channels own their own guards. Both prices are tick-aligned.
 *
 * ponytail: the package has no candle magnet, so `magnetPrice` equals `rawPrice`;
 * the field stays so the ported tool configs read it unchanged.
 */
export type DrawingSample = {
  x: number;
  y: number;
  time: number | null;
  rawPrice: number | null;
  magnetPrice: number | null;
};

/** Production ChartGeometry adapter for drawing-tool drags. */
export function createDrawingGeometry(
  ctx: ChartPluginContext,
  tickSize: () => number,
): ChartGeometry<DrawingSample> {
  const { chart, series, container } = ctx;
  return {
    paneCoords(e: MouseEvent) {
      // Pane-local, not container-local: the container also spans the time axis.
      const rect = (ctx.paneEl?.() ?? container).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= chart.timeScale().width()) return null; // over the price axis, not the plot
      if (y < 0 || y > rect.height) return null; // the time axis
      return { x, y };
    },
    sampleAt(x: number, y: number) {
      const raw = priceAtY(series, y);
      const price = raw == null ? null : snapToTick(raw, tickSize());
      return { x, y, time: timeAtX(chart, x), rawPrice: price, magnetPrice: price };
    },
    lockScroll(locked: boolean) {
      chart.applyOptions({ handleScroll: !locked, handleScale: !locked });
    },
  };
}
