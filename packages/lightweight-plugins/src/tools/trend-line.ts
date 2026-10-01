import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";
import { TrendLinePrimitive } from "../primitives/TrendLinePrimitive";
import type { TrendData } from "../primitives/TrendLinePrimitive";
import type { DrawingStyle } from "../lib/drawing-style";
import { priceAtY, timeAtX, timeToCoordinateOrNearest } from "../lib/chart-measure";
import type { DrawingToolConfig, DrawingToolKit } from "../harness/drawing-tool-plugin";
import type { GestureVerdict } from "../harness/chart-gesture";

type Pt = { price: number; time: number };

type TrendHit = {
  x: number;
  y: number;
  endpoint: { trendId: number; endpoint: "p1" | "p2" } | null;
  line: number | null;
};

type TrendDragCtx =
  | { kind: "endpoint"; trendId: number; endpoint: "p1" | "p2" }
  | { kind: "whole"; trendId: number; startPrice: number; startTime: number; origP1: Pt; origP2: Pt };

export function trendConfig(
  primitive: TrendLinePrimitive,
  env: ToolEnv,
): DrawingToolConfig<TrendData, DrawingStyle, TrendHit, TrendDragCtx> {
  const slice = env.drawings.slice("trend");

  return {
    env,
    name: "trend-line-tool",
    tool: "trend",
    primitive: {
      select: (id) => primitive.select(id),
      selectedId: () => primitive.selectedId,
      selectedItem: () => primitive.getSelected(),
      selectedY: () => primitive.getSelectedY(),
      setDragging: (d) => primitive.setDragging(d),
      setHovered: (id) => primitive.setHovered(id),
      applyData: (items) => primitive.setData(items),
    },
    primitives: () => [primitive],
    slice,
    style: {
      get: () => env.tools.getLastUsedStyle("trend"),
      remember: (patch) => env.tools.setLastUsedStyle("trend", patch),
    },

    gesture(ctx: ChartPluginContext, kit: DrawingToolKit) {
      const { chart, series } = ctx;

      return {
        hitTest(x: number, y: number): TrendHit | null {
          const endpoint = primitive.endpointHitTest(x, y);
          const line = endpoint ? null : primitive.lineHitTest(x, y);
          if (!endpoint && line == null) return null;
          return { x, y, endpoint, line };
        },

        onHit(hit): GestureVerdict<TrendDragCtx> {
          if (hit.endpoint) {
            kit.select(hit.endpoint.trendId);
            return {
              kind: "drag",
              channel: "endpoint",
              ctx: { kind: "endpoint", trendId: hit.endpoint.trendId, endpoint: hit.endpoint.endpoint },
            };
          }

          if (hit.line != null) {
            kit.select(hit.line);
            const t = slice.items().find((x) => x.id === hit.line);
            const cursorPrice = priceAtY(series, hit.y);
            const cursorTime = timeAtX(chart, hit.x);
            if (t && cursorPrice != null && cursorTime != null) {
              return {
                kind: "drag",
                channel: "whole",
                ctx: {
                  kind: "whole",
                  trendId: hit.line,
                  startPrice: cursorPrice,
                  startTime: cursorTime,
                  origP1: { ...t.p1 },
                  origP2: { ...t.p2 },
                },
              };
            }
            return { kind: "done" };
          }

          return { kind: "ignore" };
        },

        channels: {
          endpoint: {
            preview(c, s) {
              if (c.kind !== "endpoint" || s.magnetPrice == null || s.time == null) return;
              slice.update(c.trendId, { [c.endpoint]: { price: s.magnetPrice, time: s.time } });
            },
            drop() {}, // live store updates are the drag; nothing to commit
            clear() {},
          },
          whole: {
            preview(c, s) {
              if (c.kind !== "whole" || s.rawPrice == null || s.time == null) return;
              const priceDelta = s.rawPrice - c.startPrice;
              const timeDelta = s.time - c.startTime;
              slice.update(c.trendId, {
                p1: { price: c.origP1.price + priceDelta, time: c.origP1.time + timeDelta },
                p2: { price: c.origP2.price + priceDelta, time: c.origP2.time + timeDelta },
              });
            },
            drop() {},
            clear() {},
          },
        },
      };
    },

    creation(ctx: ChartPluginContext) {
      const { chart, series } = ctx;
      return {
        mode: "two-click" as const,
        acceptAnchor: (s) => s.magnetPrice != null && s.time != null,
        previewStep(anchor, s) {
          const anchorX = timeToCoordinateOrNearest(chart, anchor.time!) ?? s.x;
          if (s.magnetPrice == null) return;
          const y1 = series.priceToCoordinate(anchor.magnetPrice!) ?? 0;
          const y2 = series.priceToCoordinate(s.magnetPrice) ?? 0;
          const style = { ...env.tools.getLastUsedStyle("trend") };
          primitive.setPreview({ x1: anchorX, y1, x2: s.x, y2, style });
        },
        clearPreview: () => primitive.setPreview(null),
        create(anchor, s, id, style) {
          if (s.magnetPrice == null || s.time == null) return null;
          return {
            id,
            p1: { price: anchor.magnetPrice!, time: anchor.time! },
            p2: { price: s.magnetPrice, time: s.time },
            style,
          };
        },
      };
    },

    hover(x, y) {
      const endpoint = primitive.endpointHitTest(x, y);
      const line = !endpoint ? primitive.lineHitTest(x, y) : null;
      const id = endpoint ? endpoint.trendId : line;
      return { id, precision: endpoint ? "corner" : "body" };
    },
  };
}
