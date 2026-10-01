import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";
import { HorizontalLinePrimitive, type HLineData } from "../primitives/HorizontalLinePrimitive";
import type { DrawingStyle } from "../lib/drawing-style";
import { timeAtX } from "../lib/chart-measure";
import type { DrawingToolConfig, DrawingToolKit } from "../harness/drawing-tool-plugin";
import type { GestureVerdict } from "../harness/chart-gesture";
import type { DrawingSample } from "../harness/drawing-gesture-geometry";

type HLineHit = {
  x: number;
  hovered: number;
};

type HLineDragCtx = { id: number; timeOffset: number };

export function hlineConfig(
  primitive: HorizontalLinePrimitive,
  env: ToolEnv,
): DrawingToolConfig<HLineData, DrawingStyle, HLineHit, HLineDragCtx> {
  const slice = env.drawings.slice("hline");

  // setData needs the mount's container and the active tick size; stashed by onMountEffect.
  let container: HTMLDivElement | null = null;

  return {
    env,
    name: "horizontal-line",
    tool: "h-line",
    primitive: {
      select: (id) => primitive.select(id),
      selectedId: () => primitive.selectedId,
      selectedItem: () => primitive.getSelected(),
      selectedY: () => primitive.getSelectedY(),
      setDragging: (d) => primitive.setDragging(d),
      setHovered: (id) => primitive.setHovered(id),
      applyData: (items) => {
        if (!container) return;
        const tickSize = env.tickSize();
        primitive.setData(items, container, tickSize);
      },
    },
    primitives: () => [primitive],
    slice,
    style: {
      get: () => env.tools.getLastUsedStyle("h-line"),
      remember: (patch) => env.tools.setLastUsedStyle("h-line", patch),
    },

    onMountEffect(ctx: ChartPluginContext) {
      container = ctx.container;
      return () => {
        container = null;
      };
    },

    gesture(ctx: ChartPluginContext, kit: DrawingToolKit) {
      const { chart } = ctx;

      return {
        // Selection + drag arm off the hovered line, matching the old hook.
        hitTest(x: number): HLineHit | null {
          const hovered = primitive.hoveredId;
          if (hovered == null) return null;
          return { x, hovered };
        },

        onHit(hit): GestureVerdict<HLineDragCtx> {
          kit.select(hit.hovered);
          const line = slice.items().find((l) => l.id === hit.hovered);
          const cursorTime = timeAtX(chart, hit.x);
          if (line && cursorTime != null) {
            return { kind: "drag", channel: "move", ctx: { id: hit.hovered, timeOffset: line.time - cursorTime } };
          }
          return { kind: "done" }; // selected; drag not resolvable at this x
        },

        channels: {
          move: {
            preview(c, s) {
              // A horizontal line is a single price level: place it AT the (soft-magnet)
              // cursor price, not offset by grab position. Time keeps its grab offset for
              // horizontal drag feel.
              if (s.magnetPrice == null) return;
              slice.update(c.id, {
                price: s.magnetPrice,
                ...(s.time != null ? { time: s.time + c.timeOffset } : {}),
              });
            },
            drop() {}, // live store updates are the drag; nothing to commit
            clear() {},
          },
        },
      };
    },

    creation(ctx: ChartPluginContext) {
      const { series } = ctx;
      return {
        mode: "one-click" as const,
        preview(s: DrawingSample) {
          const snapY = s.magnetPrice != null ? (series.priceToCoordinate(s.magnetPrice) ?? s.y) : s.y;
          primitive.setPreview(s.x, snapY);
        },
        clearPreview: () => primitive.setPreview(null, null),
        create(s: DrawingSample, id: number, style: DrawingStyle): HLineData | null {
          if (s.magnetPrice == null || s.time == null) return null;
          return { id, price: s.magnetPrice, time: s.time, style };
        },
      };
    },

    hover(x, y) {
      const origin = primitive.originHitTest(x, y);
      const id = origin ?? primitive.lineHitTest(x, y);
      return { id, precision: origin != null ? "corner" : "body" };
    },
  };
}
