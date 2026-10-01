import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";
import { FreeDrawPrimitive, type FreeStrokeData, type FreePoint } from "../primitives/FreeDrawPrimitive";
import { priceAtY, timeAtX } from "../lib/chart-measure";
import type { DrawingStyle } from "../lib/drawing-style";
import type { DrawingToolConfig, DrawingToolKit } from "../harness/drawing-tool-plugin";
import type { GestureVerdict } from "../harness/chart-gesture";

/** Minimum pixel gap between accumulated freehand samples (perf guard). */
const MIN_POINT_DISTANCE = 2;

type FreeDrawHit = { x: number; y: number; body: number | null; hovered: number | null };
type FreeDrawDragCtx = {
  kind: "whole";
  id: number;
  startPrice: number;
  startTime: number;
  origPoints: FreePoint[];
};

export function freeDrawConfig(
  primitive: FreeDrawPrimitive,
  env: ToolEnv,
): DrawingToolConfig<FreeStrokeData, DrawingStyle, FreeDrawHit, FreeDrawDragCtx> {
  const slice = env.drawings.slice("freedraw");

  return {
    env,
    name: "free-draw-tool",
    tool: "free-draw",
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
      get: () => env.tools.getLastUsedStyle("path"),
      remember: (patch) => env.tools.setLastUsedStyle("path", patch),
    },

    gesture(ctx: ChartPluginContext, kit: DrawingToolKit) {
      const { chart, series } = ctx;
      return {
        hitTest(x: number, y: number): FreeDrawHit | null {
          const body = primitive.strokeHitTest(x, y);
          const hovered = primitive.hoveredId;
          if (body == null && hovered == null) return null;
          return { x, y, body, hovered };
        },
        onHit(hit: FreeDrawHit): GestureVerdict<FreeDrawDragCtx> {
          if (hit.hovered != null) {
            kit.select(hit.hovered);
            const item = slice.items().find((s) => s.id === hit.hovered);
            const cursorPrice = priceAtY(series, hit.y);
            const cursorTime = timeAtX(chart, hit.x);
            if (item && cursorPrice != null && cursorTime != null) {
              return {
                kind: "drag",
                channel: "whole",
                ctx: {
                  kind: "whole",
                  id: hit.hovered,
                  startPrice: cursorPrice,
                  startTime: cursorTime,
                  origPoints: item.points.map((pt) => ({ ...pt })),
                },
              };
            }
            return { kind: "done" };
          }
          kit.select(null);
          return { kind: "ignore" };
        },
        channels: {
          whole: {
            preview(c, s) {
              if (c.kind !== "whole" || s.rawPrice == null || s.time == null) return;
              const priceDelta = s.rawPrice - c.startPrice;
              const timeDelta = s.time - c.startTime;
              const newPoints = c.origPoints.map((pt) => ({ price: pt.price + priceDelta, time: pt.time + timeDelta }));
              slice.update(c.id, { points: newPoints });
            },
            drop() {},
            clear() {},
          },
        },
      };
    },

    creation() {
      let lastXY: { x: number; y: number } | null = null;

      return {
        mode: "custom" as const,

        hasPending: () => primitive.buildingPoints.length > 0,

        onMouseDown(_e: MouseEvent, s) {
          if (s.magnetPrice == null || s.time == null) return false;
          const style = env.tools.getLastUsedStyle("path");
          primitive.buildingColor = style.color;
          primitive.buildingWidth = style.width;
          primitive.addBuildingPoint({ price: s.magnetPrice, time: s.time });
          lastXY = { x: s.x, y: s.y };
          env.lockScroll(true);
          return true;
        },

        onMouseMove(_e: MouseEvent, s) {
          if (primitive.buildingPoints.length === 0) return;
          if (s.magnetPrice == null || s.time == null) return;
          if (lastXY && Math.hypot(s.x - lastXY.x, s.y - lastXY.y) < MIN_POINT_DISTANCE) return;
          primitive.addBuildingPoint({ price: s.magnetPrice, time: s.time });
          lastXY = { x: s.x, y: s.y };
        },

        cancel() {
          if (primitive.buildingPoints.length === 0) return;
          primitive.cancelBuilding();
          lastXY = null;
          env.lockScroll(false);
        },
      };
    },

    hover(x: number, y: number) {
      return { id: primitive.strokeHitTest(x, y), precision: "body" as const };
    },

    onMountEffect(ctx: ChartPluginContext) {
      // Custom-creation mode has no mouse-up hook in the harness; finalize the
      // freehand stroke on window mouseup here (self-contained, no harness change).
      // The tool intentionally stays armed after finalizing so consecutive
      // strokes can be drawn like a pencil; Escape / right-click disarms.
      const finalize = () => {
        if (primitive.buildingPoints.length === 0) return;
        const id = env.drawings.generateId();
        const style = env.tools.getLastUsedStyle("path");
        const data = primitive.finalizeBuildingPoints(id, { ...style });
        if (data) slice.add(data);
        env.lockScroll(false);
      };
      const win = ctx.container.ownerDocument.defaultView!;
      win.addEventListener("mouseup", finalize);
      return () => win.removeEventListener("mouseup", finalize);
    },
  };
}
