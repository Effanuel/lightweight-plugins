import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";
import { VerticalLinePrimitive, type VLineData } from "../primitives/VerticalLinePrimitive";
import type { DrawingStyle } from "../lib/drawing-style";
import { timeAtX } from "../lib/chart-measure";
import type { DrawingToolConfig, DrawingToolKit } from "../harness/drawing-tool-plugin";
import type { GestureVerdict } from "../harness/chart-gesture";
import type { DrawingSample } from "../harness/drawing-gesture-geometry";

type VLineHit = {
  x: number;
  hovered: number;
};

type VLineDragCtx = { id: number; timeOffset: number };

export function vlineConfig(
  primitive: VerticalLinePrimitive,
  env: ToolEnv,
): DrawingToolConfig<VLineData, DrawingStyle, VLineHit, VLineDragCtx> {
  const slice = env.drawings.slice("vline");

  // setData needs the mount's container; stashed by onMountEffect.
  let container: HTMLDivElement | null = null;

  return {
    env,
    name: "vertical-line",
    tool: "v-line",
    primitive: {
      select: (id) => primitive.select(id),
      selectedId: () => primitive.selectedId,
      selectedItem: () => primitive.getSelected(),
      selectedY: () => primitive.getSelectedY(),
      setDragging: (d) => primitive.setDragging(d),
      setHovered: (id) => primitive.setHovered(id),
      applyData: (items) => {
        if (container) primitive.setData(items, container);
      },
    },
    primitives: () => [primitive],
    slice,
    style: {
      get: () => env.tools.getLastUsedStyle("v-line"),
      remember: (patch) => env.tools.setLastUsedStyle("v-line", patch),
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
        hitTest(x: number): VLineHit | null {
          const hovered = primitive.hoveredId;
          if (hovered == null) return null;
          return { x, hovered };
        },

        onHit(hit): GestureVerdict<VLineDragCtx> {
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
              // A vertical line drags by time (with grab offset); price tracks the raw
              // cursor price when resolvable, never magnet-snapped.
              if (s.time == null) return;
              slice.update(c.id, {
                time: s.time + c.timeOffset,
                ...(s.rawPrice != null ? { price: s.rawPrice } : {}),
              });
            },
            drop() {}, // live store updates are the drag; nothing to commit
            clear() {},
          },
        },
      };
    },

    creation() {
      return {
        mode: "one-click" as const,
        preview: (s: DrawingSample) => primitive.setPreview(s.x, s.y),
        clearPreview: () => primitive.setPreview(null, null),
        create(s: DrawingSample, id: number, style: DrawingStyle): VLineData | null {
          // Raw price, never magnet-snapped — the anchor rides the cursor.
          if (s.time == null || s.rawPrice == null) return null;
          return { id, time: s.time, price: s.rawPrice, style };
        },
      };
    },

    hover(x, y) {
      const anchor = primitive.anchorHitTest(x, y);
      const id = anchor ?? primitive.lineHitTest(x, y);
      return { id, precision: anchor != null ? "corner" : "body" };
    },
  };
}
