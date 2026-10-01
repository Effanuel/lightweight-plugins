import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";
import { HorizontalRayPrimitive, type RayData } from "../primitives/HorizontalRayPrimitive";
import type { DrawingStyle } from "../lib/drawing-style";
import { timeAtX } from "../lib/chart-measure";
import type { DrawingToolConfig, DrawingToolKit } from "../harness/drawing-tool-plugin";
import type { GestureVerdict } from "../harness/chart-gesture";
import type { DrawingSample } from "../harness/drawing-gesture-geometry";
import { cloneRay, NO_OFFSET } from "../lib/drawing-clone";

// All hit candidates at the mousedown point; onHit picks by priority (and altKey).
type RayHit = {
  x: number;
  y: number;
  /** Geometric origin/ray hit — the alt+drag clone target. */
  clone: number | null;
  hovered: number | null;
};

type RayDragCtx = { id: number; timeOffset: number };

export function rayConfig(
  primitive: HorizontalRayPrimitive,
  env: ToolEnv,
): DrawingToolConfig<RayData, DrawingStyle, RayHit, RayDragCtx> {
  const slice = env.drawings.slice("ray");

  // setData needs the mount's container and the active tick size; stashed by onMountEffect.
  let container: HTMLDivElement | null = null;

  return {
    env,
    name: "horizontal-ray",
    tool: "h-ray",
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
      get: () => env.tools.getLastUsedStyle("h-ray"),
      remember: (patch) => env.tools.setLastUsedStyle("h-ray", patch),
    },

    onMountEffect(ctx: ChartPluginContext) {
      container = ctx.container;
      return () => {
        container = null;
      };
    },

    gesture(ctx: ChartPluginContext, kit: DrawingToolKit) {
      const { chart } = ctx;

      const dragCtx = (id: number, itemTime: number, x: number): RayDragCtx | null => {
        const cursorTime = timeAtX(chart, x);
        if (cursorTime == null) return null;
        return { id, timeOffset: itemTime - cursorTime };
      };

      return {
        hitTest(x: number, y: number): RayHit | null {
          const clone = primitive.originHitTest(x, y) ?? primitive.rayHitTest(x, y);
          const hovered = primitive.hoveredId;
          if (clone == null && hovered == null) return null;
          return { x, y, clone, hovered };
        },

        onHit(hit, e): GestureVerdict<RayDragCtx> {
          // Alt+drag clones the ray under the cursor in place and drags the copy.
          if (e.altKey && hit.clone != null) {
            const orig = slice.items().find((r) => r.id === hit.clone);
            if (orig) {
              const newId = env.drawings.generateId();
              const clone = cloneRay(orig, newId, NO_OFFSET);
              const ctxDrag = dragCtx(newId, clone.time, hit.x);
              if (ctxDrag) {
                slice.add(clone); // through the slice
                kit.select(newId);
                return { kind: "drag", channel: "move", ctx: ctxDrag };
              }
            }
          }

          // Selection + drag arm off the hovered ray, matching the old hook.
          if (hit.hovered != null) {
            kit.select(hit.hovered);
            const ray = slice.items().find((r) => r.id === hit.hovered);
            const ctxDrag = ray ? dragCtx(ray.id, ray.time, hit.x) : null;
            if (ctxDrag) return { kind: "drag", channel: "move", ctx: ctxDrag };
            return { kind: "done" }; // selected; drag not resolvable at this x
          }

          // Geometric hit without a hover halo: behaves like empty space (deselect).
          kit.select(null);
          return { kind: "ignore" };
        },

        channels: {
          move: {
            preview(c, s) {
              // A ray is a single price level: place it AT the (soft-magnet) cursor price,
              // not offset by where it was grabbed — otherwise the grab gap pushes it off
              // the snapped OHLC level. Time keeps its grab offset for horizontal drag feel.
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
        create(s: DrawingSample, id: number, style: DrawingStyle): RayData | null {
          if (s.magnetPrice == null || s.time == null) return null;
          return { id, price: s.magnetPrice, time: s.time, style };
        },
      };
    },

    hover(x, y) {
      const origin = primitive.originHitTest(x, y);
      const id = origin ?? primitive.rayHitTest(x, y);
      return { id, precision: origin != null ? "corner" : "body" };
    },
  };
}
