import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";
import { PathToolPrimitive, type PathData, type PathPoint } from "../primitives/PathToolPrimitive";
import { priceAtY, timeAtX } from "../lib/chart-measure";
import type { DrawingStyle } from "../lib/drawing-style";
import type { DrawingToolConfig, DrawingToolKit } from "../harness/drawing-tool-plugin";
import type { GestureVerdict } from "../harness/chart-gesture";
import { clonePath, NO_OFFSET } from "../lib/drawing-clone";

/** Max pixel distance from the previous click that finalizes the path. */
const CLOSE_DISTANCE = 10;

// All hit candidates at the mousedown point; onHit picks by priority (and altKey).
type PathHit = {
  x: number;
  y: number;
  corner: { pathId: number; pointIndex: number } | null;
  body: number | null;
  hovered: number | null;
};

type PathDragCtx =
  | { kind: "corner"; pathId: number; pointIndex: number }
  | { kind: "whole"; pathId: number; startPrice: number; startTime: number; origPoints: PathPoint[] };

export function pathConfig(
  primitive: PathToolPrimitive,
  env: ToolEnv,
): DrawingToolConfig<PathData, DrawingStyle, PathHit, PathDragCtx> {
  const slice = env.drawings.slice("path");

  return {
    env,
    name: "path-tool",
    tool: "path",
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

      const wholeDragCtx = (pathId: number, points: PathPoint[], x: number, y: number): PathDragCtx | null => {
        const cursorPrice = priceAtY(series, y);
        const cursorTime = timeAtX(chart, x);
        if (cursorPrice == null || cursorTime == null) return null;
        return {
          kind: "whole",
          pathId,
          startPrice: cursorPrice,
          startTime: cursorTime,
          origPoints: points.map((pt) => ({ ...pt })),
        };
      };

      return {
        hitTest(x: number, y: number): PathHit | null {
          const corner = primitive.cornerHitTest(x, y);
          const body = primitive.pathHitTest(x, y);
          const hovered = primitive.hoveredId;
          if (!corner && body == null && hovered == null) return null;
          return { x, y, corner, body, hovered };
        },

        onHit(hit, e): GestureVerdict<PathDragCtx> {
          // Alt+drag clones the path under the cursor in place and drags the copy.
          if (e.altKey && hit.body != null) {
            const orig = slice.items().find((p) => p.id === hit.body);
            if (orig) {
              const newId = env.drawings.generateId();
              const clone = clonePath(orig, newId, NO_OFFSET);
              const ctxDrag = wholeDragCtx(newId, clone.points, hit.x, hit.y);
              if (ctxDrag) {
                slice.add(clone);
                kit.select(newId);
                return { kind: "drag", channel: "whole", ctx: ctxDrag };
              }
            }
          }

          if (hit.corner) {
            kit.select(hit.corner.pathId);
            return {
              kind: "drag",
              channel: "corner",
              ctx: { kind: "corner", pathId: hit.corner.pathId, pointIndex: hit.corner.pointIndex },
            };
          }

          // Segment (body) drag — only from the path that won hover.
          if (hit.hovered != null) {
            kit.select(hit.hovered);
            const path = slice.items().find((p) => p.id === hit.hovered);
            const ctxDrag = path ? wholeDragCtx(hit.hovered, path.points, hit.x, hit.y) : null;
            if (ctxDrag) return { kind: "drag", channel: "whole", ctx: ctxDrag };
            return { kind: "done" };
          }

          // Body of a non-hovered path: behaves like empty space (deselect).
          kit.select(null);
          return { kind: "ignore" };
        },

        channels: {
          corner: {
            preview(c, s) {
              if (c.kind !== "corner" || s.magnetPrice == null || s.time == null) return;
              const path = slice.items().find((p) => p.id === c.pathId);
              if (!path) return;
              const point = { price: s.magnetPrice, time: s.time };
              const newPoints = path.points.map((pt, i) => (i === c.pointIndex ? point : pt));
              slice.update(c.pathId, { points: newPoints });
            },
            drop() {}, // live store updates are the drag; nothing to commit
            clear() {},
          },
          whole: {
            preview(c, s) {
              if (c.kind !== "whole" || s.rawPrice == null || s.time == null) return;
              const priceDelta = s.rawPrice - c.startPrice;
              const timeDelta = s.time - c.startTime;
              const newPoints = c.origPoints.map((pt) => ({ price: pt.price + priceDelta, time: pt.time + timeDelta }));
              slice.update(c.pathId, { points: newPoints });
            },
            drop() {},
            clear() {},
          },
        },
      };
    },

    creation(ctx: ChartPluginContext, kit: DrawingToolKit) {
      const { chart, series } = ctx;
      const lockScroll = (locked: boolean) => chart.applyOptions({ handleScroll: !locked, handleScale: !locked });
      // Multi-click build: a click within CLOSE_DISTANCE of the previous click finalizes.
      let lastClick = { x: 0, y: 0 };

      return {
        mode: "custom" as const,

        hasPending: () => primitive.buildingPoints.length > 0,

        onMouseDown(_e: MouseEvent, s) {
          if (s.magnetPrice == null || s.time == null) return false;

          if (primitive.buildingPoints.length >= 1) {
            const dist = Math.hypot(s.x - lastClick.x, s.y - lastClick.y);
            if (dist <= CLOSE_DISTANCE) {
                            const id = env.drawings.generateId();
              const style = env.tools.getLastUsedStyle("path");
              const pathData = primitive.finalizeBuildingPoints(id, true, { ...style });
              if (pathData) {
                slice.add(pathData);
                kit.select(id);
              }
              primitive.setPreview(null);
              env.tools.clearTool();
              lockScroll(false);
              return true;
            }
          }

          if (primitive.buildingPoints.length === 0) {
            primitive.buildingColor = env.tools.getLastUsedStyle("path").color;
          }
          primitive.addBuildingPoint({ price: s.magnetPrice, time: s.time });
          lastClick = { x: s.x, y: s.y };
          lockScroll(true);
          return true;
        },

        onMouseMove(_e: MouseEvent, s) {
          if (primitive.buildingPoints.length === 0) return;
          const snapY = s.magnetPrice != null ? (series.priceToCoordinate(s.magnetPrice) ?? s.y) : s.y;
          primitive.setPreview({ x: s.x, y: snapY });
        },

        cancel() {
          if (primitive.buildingPoints.length === 0) return;
          primitive.cancelBuilding();
          lockScroll(false);
        },
      };
    },

    hover(x, y) {
      const corner = primitive.cornerHitTest(x, y);
      const id = corner ? corner.pathId : primitive.pathHitTest(x, y);
      return { id, precision: corner ? "corner" : "body" };
    },

    onMountEffect(ctx: ChartPluginContext) {
      // The harness only clears two-click previews on mouseleave; the custom
      // build preview (dangling segment to the cursor) must clear itself.
      const clearPreview = () => primitive.setPreview(null);
      ctx.container.addEventListener("mouseleave", clearPreview);
      return () => ctx.container.removeEventListener("mouseleave", clearPreview);
    },
  };
}
