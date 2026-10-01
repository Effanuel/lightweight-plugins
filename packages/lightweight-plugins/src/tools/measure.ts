import type { ChartPlugin, ChartPluginContext, ClickResult, Teardown, ToolEnv } from "../harness/chart-plugin";
import { MeasuringToolPrimitive } from "../primitives/MeasuringToolPrimitive";
import { computeMeasurement, getChartPaneCoords, priceAtY, timeAtX, type MeasurePoint } from "../lib/chart-measure";

/**
 * Two-click measure: anchor, then end. The result stays until the next chart
 * click. Not a drawing — never stored. Terminal's measuring
 * tool without the magnet and the range-mode reset.
 */
export function createMeasureTool(env: ToolEnv): ChartPlugin {
  const primitive = new MeasuringToolPrimitive();
  let justFinalized = false;
  const armed = () => env.tools.activeTool === "measure";

  return {
    name: "measuring-tool",
    clickPriority: 200,

    primitives() {
      return [primitive];
    },

    onChartClick(): ClickResult {
      if (armed()) return "consumed";
      if (justFinalized) {
        justFinalized = false;
        return "consumed";
      }
      if (primitive.measurement) {
        primitive.clearMeasurement();
        return "consumed";
      }
      return "pass";
    },

    onMount(ctx: ChartPluginContext): Teardown {
      const { chart, series, container } = ctx;
      let anchor: MeasurePoint | null = null;

      const pointAt = (e: MouseEvent): MeasurePoint | null => {
        const pos = getChartPaneCoords(e, container);
        if (pos.x >= chart.timeScale().width()) return null;
        const price = priceAtY(series, pos.y);
        const time = timeAtX(chart, pos.x);
        return price == null || time == null ? null : { price, time };
      };

      const onMouseDown = (e: MouseEvent) => {
        if (!armed() || e.button !== 0) return;
        const point = pointAt(e);
        if (!point) return;
        if (!anchor) {
          anchor = point;
          primitive.clearMeasurement();
          env.lockScroll(true);
        } else {
          primitive.setMeasurement(anchor, point, computeMeasurement(chart, anchor, point));
          anchor = null;
          env.lockScroll(false);
          justFinalized = true;
          env.tools.clearTool();
        }
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!anchor) return;
        const point = pointAt(e);
        if (point) primitive.setMeasurement(anchor, point, computeMeasurement(chart, anchor, point));
      };

      const cancel = (disarm = true) => {
        if (anchor) {
          anchor = null;
          env.lockScroll(false);
        }
        primitive.clearMeasurement();
        if (disarm) env.tools.clearTool();
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (env.keysActive() && e.key === "Escape") cancel();
      };

      const onContextMenu = (e: MouseEvent) => {
        if (!armed()) return;
        e.preventDefault();
        cancel();
      };

      // Another tool was armed (or none) mid-measurement: abandon it. A finished measurement has no anchor, so it stays.
      const unsubTool = env.tools.subscribe((tool) => {
        if (tool !== "measure" && anchor) cancel(false);
      });

      const doc = container.ownerDocument;
      container.addEventListener("mousedown", onMouseDown);
      container.addEventListener("mousemove", onMouseMove);
      container.addEventListener("contextmenu", onContextMenu);
      doc.addEventListener("keydown", onKeyDown);

      return () => {
        cancel(false);
        unsubTool();
        container.removeEventListener("mousedown", onMouseDown);
        container.removeEventListener("mousemove", onMouseMove);
        container.removeEventListener("contextmenu", onContextMenu);
        doc.removeEventListener("keydown", onKeyDown);
      };
    },
  };
}
