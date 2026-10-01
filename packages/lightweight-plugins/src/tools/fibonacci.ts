import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";
import { FibonacciPrimitive } from "../primitives/FibonacciPrimitive";
import type { FibData } from "../model";
import type { DrawingStyle } from "../lib/drawing-style";
import { priceAtY, timeAtX, timeToCoordinateOrNearest } from "../lib/chart-measure";
import { formatChartPrice } from "../primitives/chart-drawing";
import type { DrawingToolConfig, DrawingToolKit } from "../harness/drawing-tool-plugin";
import type { GestureVerdict } from "../harness/chart-gesture";
import { cloneFib, NO_OFFSET } from "../lib/drawing-clone";
import { DEFAULT_FIB_LEVELS, visibleFibLevels, type FibLevel } from "../lib/fib-levels";

type Pt = { price: number; time: number };

type FibHit = {
  x: number;
  y: number;
  endpoint: { fibId: number; endpoint: "p1" | "p2" } | null;
  line: number | null;
};

type FibDragCtx =
  | { kind: "endpoint"; fibId: number; endpoint: "p1" | "p2" }
  | { kind: "whole"; fibId: number; startPrice: number; startTime: number; origP1: Pt; origP2: Pt };

export function fibConfig(
  primitive: FibonacciPrimitive,
  env: ToolEnv,
): DrawingToolConfig<FibData, DrawingStyle, FibHit, FibDragCtx> {
  const slice = env.drawings.slice("fib");

  return {
    env,
    name: "fibonacci-tool",
    tool: "fibonacci",
    primitive: {
      select: (id) => primitive.select(id),
      selectedId: () => primitive.selectedId,
      selectedItem: () => primitive.getSelected(),
      selectedY: () => primitive.getSelectedY(),
      setDragging: (d) => primitive.setDragging(d),
      setHovered: (id) => primitive.setHovered(id),
      applyData: (items) =>
        primitive.setData(items, env.tickSize()),
    },
    primitives: () => [primitive],
    slice,
    style: {
      get: () => env.tools.getLastUsedStyle("fibonacci"),
      remember: (patch) => env.tools.setLastUsedStyle("fibonacci", patch),
    },

    gesture(ctx: ChartPluginContext, kit: DrawingToolKit) {
      const { chart, series } = ctx;

      const wholeDragCtx = (fibId: number, fib: FibData, x: number, y: number): FibDragCtx | null => {
        const cursorPrice = priceAtY(series, y);
        const cursorTime = timeAtX(chart, x);
        if (cursorPrice == null || cursorTime == null) return null;
        return {
          kind: "whole",
          fibId,
          startPrice: cursorPrice,
          startTime: cursorTime,
          origP1: { ...fib.p1 },
          origP2: { ...fib.p2 },
        };
      };

      return {
        hitTest(x: number, y: number): FibHit | null {
          const endpoint = primitive.endpointHitTest(x, y);
          const line = primitive.lineHitTest(x, y);
          if (!endpoint && line == null) return null;
          return { x, y, endpoint, line };
        },

        onHit(hit, e): GestureVerdict<FibDragCtx> {
          // Alt+drag clones the fib under the cursor in place and drags the copy.
          if (e.altKey && hit.line != null) {
            const orig = slice.items().find((f) => f.id === hit.line);
            if (orig) {
              const newId = env.drawings.generateId();
              const clone = cloneFib(orig, newId, NO_OFFSET);
              const ctxDrag = wholeDragCtx(newId, clone, hit.x, hit.y);
              if (ctxDrag) {
                slice.add(clone); // through the slice
                kit.select(newId);
                return { kind: "drag", channel: "whole", ctx: ctxDrag };
              }
            }
          }

          if (hit.endpoint) {
            kit.select(hit.endpoint.fibId);
            return {
              kind: "drag",
              channel: "endpoint",
              ctx: { kind: "endpoint", fibId: hit.endpoint.fibId, endpoint: hit.endpoint.endpoint },
            };
          }

          if (hit.line != null) {
            kit.select(hit.line);
            const fib = slice.items().find((f) => f.id === hit.line);
            const ctxDrag = fib ? wholeDragCtx(hit.line, fib, hit.x, hit.y) : null;
            if (ctxDrag) return { kind: "drag", channel: "whole", ctx: ctxDrag };
            return { kind: "done" };
          }

          return { kind: "ignore" };
        },

        channels: {
          endpoint: {
            preview(c, s) {
              if (c.kind !== "endpoint" || s.magnetPrice == null || s.time == null) return;
              slice.update(c.fibId, { [c.endpoint]: { price: s.magnetPrice, time: s.time } });
            },
            drop() {}, // live store updates are the drag; nothing to commit
            clear() {},
          },
          whole: {
            preview(c, s) {
              if (c.kind !== "whole" || s.rawPrice == null || s.time == null) return;
              const priceDelta = s.rawPrice - c.startPrice;
              const timeDelta = s.time - c.startTime;
              slice.update(c.fibId, {
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
          if (s.magnetPrice == null) return;
          const anchorPrice = anchor.magnetPrice!;
          const cursorPrice = s.magnetPrice;
          const anchorX = timeToCoordinateOrNearest(chart, anchor.time!) ?? s.x;

          const p1Y = series.priceToCoordinate(anchorPrice) ?? 0;
          const p2Y = series.priceToCoordinate(cursorPrice) ?? 0;

          const range = anchorPrice - cursorPrice;
          const tickSize = env.tickSize();
          const levels = visibleFibLevels(env.tools.fibLevels).map((lvl) => {
            const price = cursorPrice + range * lvl.value;
            return {
              y: series.priceToCoordinate(price) ?? 0,
              level: lvl.value,
              priceLabel: formatChartPrice(price, tickSize),
              color: lvl.color,
            };
          });

          const style = { ...env.tools.getLastUsedStyle("fibonacci") };
          const rightEdge = chart.timeScale().width();
          primitive.setPreview({ x1: anchorX, x2: s.x, rightEdge, levels, style, p1Y, p2Y });
        },
        clearPreview: () => primitive.setPreview(null),
        create(anchor, s, id, style) {
          if (s.magnetPrice == null || s.time == null) return null;
          return {
            id,
            p1: { price: anchor.magnetPrice!, time: anchor.time! },
            p2: { price: s.magnetPrice, time: s.time },
            style,
            levels: [...env.tools.fibLevels],
          };
        },
      };
    },

    hover(x, y) {
      const endpoint = primitive.endpointHitTest(x, y);
      const line = !endpoint ? primitive.lineHitTest(x, y) : null;
      const id = endpoint ? endpoint.fibId : line;
      return { id, precision: endpoint ? "corner" : "body" };
    },
  };
}
