import type { ChartPlugin, ChartPluginContext, ClickResult, Teardown, ToolEnv } from "../harness/chart-plugin";
import { MeasuringToolPrimitive } from "../primitives/MeasuringToolPrimitive";
import { PctMeasuringPrimitive } from "../primitives/PctMeasuringPrimitive";
import { createDrawingGeometry } from "../harness/drawing-gesture-geometry";
import { computeMeasurement, type MeasurePoint } from "../lib/chart-measure";

/**
 * Two-click measure: anchor, then end. The result stays until the next chart
 * click. Not a drawing — never stored. Terminal's measuring tools without the
 * range-mode reset: "measure" shows price, ticks, bars and time; "measure-pct" the percentage.
 */
export function createMeasureTool(env: ToolEnv, tool: "measure" | "measure-pct" = "measure"): ChartPlugin {
  const primitive = tool === "measure" ? new MeasuringToolPrimitive() : new PctMeasuringPrimitive();
  let justFinalized = false;
  const armed = () => env.tools.activeTool === tool;

  return {
    name: tool === "measure" ? "measuring-tool" : "pct-measuring-tool",
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
      const { chart, container } = ctx;
      // The drawings' pane geometry: off-plot points are rejected, prices snap to the tick.
      const geometry = createDrawingGeometry(ctx, env.tickSize, env.lockScroll);
      let anchor: MeasurePoint | null = null;

      const pointAt = (e: MouseEvent): MeasurePoint | null => {
        const pos = geometry.paneCoords(e);
        if (!pos) return null;
        const s = geometry.sampleAt(pos.x, pos.y);
        return s?.magnetPrice == null || s.time == null ? null : { price: s.magnetPrice, time: s.time };
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
      const unsubTool = env.tools.subscribe((next) => {
        if (next !== tool && anchor) cancel(false);
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
