import type { ChartPluginContext, ToolEnv } from "../harness/chart-plugin";
import { BoxToolPrimitive, type CornerIndex, type EdgeIndex } from "../primitives/BoxToolPrimitive";
import type { BoxData, BoxStyle } from "../model";
import { priceAtY, timeAtX, timeToCoordinateOrNearest } from "../lib/chart-measure";
import type { DrawingToolConfig, DrawingToolKit } from "../harness/drawing-tool-plugin";
import type { GestureVerdict } from "../harness/chart-gesture";
import { cloneBox, NO_OFFSET } from "../lib/drawing-clone";

type Pt = { price: number; time: number };

// All hit candidates at the mousedown point; onHit picks by priority (and altKey).
type BoxHit = {
  x: number;
  y: number;
  corner: { boxId: number; corner: CornerIndex } | null;
  edge: { boxId: number; edge: EdgeIndex } | null;
  interior: number | null;
  hovered: number | null;
};

type BoxDragCtx =
  | { kind: "corner"; boxId: number; corner: CornerIndex }
  | { kind: "edge"; boxId: number; target: "p1" | "p2"; axis: "time" | "price" }
  | { kind: "whole"; boxId: number; startPrice: number; startTime: number; origP1: Pt; origP2: Pt };

export function boxConfig(
  primitive: BoxToolPrimitive,
  env: ToolEnv,
): DrawingToolConfig<BoxData, BoxStyle, BoxHit, BoxDragCtx> {
  const slice = env.drawings.slice("box");

  return {
    env,
    name: "box-tool",
    tool: "box",
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
      get: () => env.tools.getLastUsedBoxStyle(),
      remember: (patch) => env.tools.setLastUsedBoxStyle(patch),
    },

    gesture(ctx: ChartPluginContext, kit: DrawingToolKit) {
      const { chart, series } = ctx;

      const wholeDragCtx = (boxId: number, box: BoxData, x: number, y: number): BoxDragCtx | null => {
        const cursorPrice = priceAtY(series, y);
        const cursorTime = timeAtX(chart, x);
        if (cursorPrice == null || cursorTime == null) return null;
        return {
          kind: "whole",
          boxId,
          startPrice: cursorPrice,
          startTime: cursorTime,
          origP1: { ...box.p1 },
          origP2: { ...box.p2 },
        };
      };

      return {
        hitTest(x: number, y: number): BoxHit | null {
          const corner = primitive.cornerHitTest(x, y);
          const edge = corner ? null : primitive.edgeHitTest(x, y);
          const interior = primitive.boxHitTest(x, y);
          const hovered = primitive.hoveredId;
          if (!corner && !edge && interior == null && hovered == null) return null;
          return { x, y, corner, edge, interior, hovered };
        },

        onHit(hit, e): GestureVerdict<BoxDragCtx> {
          // Alt+drag clones the box under the cursor in place and drags the copy.
          if (e.altKey && hit.interior != null) {
            const orig = slice.items().find((b) => b.id === hit.interior);
            if (orig) {
              const newId = env.drawings.generateId();
              const clone = cloneBox(orig, newId, NO_OFFSET);
              const ctxDrag = wholeDragCtx(newId, clone, hit.x, hit.y);
              if (ctxDrag) {
                slice.add(clone); // through the slice
                kit.select(newId);
                return { kind: "drag", channel: "whole", ctx: ctxDrag };
              }
            }
          }

          if (hit.corner) {
            kit.select(hit.corner.boxId);
            return {
              kind: "drag",
              channel: "corner",
              ctx: { kind: "corner", boxId: hit.corner.boxId, corner: hit.corner.corner },
            };
          }

          if (hit.edge) {
            const box = slice.items().find((b) => b.id === hit.edge!.boxId);
            if (box) {
              kit.select(hit.edge.boxId);
              let target: "p1" | "p2";
              let axis: "time" | "price";
              if (hit.edge.edge === "left" || hit.edge.edge === "right") {
                axis = "time";
                const p1IsLeft = box.p1.time <= box.p2.time;
                target = hit.edge.edge === "left" ? (p1IsLeft ? "p1" : "p2") : p1IsLeft ? "p2" : "p1";
              } else {
                axis = "price";
                const p1IsTop = box.p1.price >= box.p2.price;
                target = hit.edge.edge === "top" ? (p1IsTop ? "p1" : "p2") : p1IsTop ? "p2" : "p1";
              }
              return { kind: "drag", channel: "edge", ctx: { kind: "edge", boxId: hit.edge.boxId, target, axis } };
            }
            return { kind: "ignore" };
          }

          // Whole-box interior drag — only on the already-selected box.
          if (primitive.selectedId != null && hit.interior === primitive.selectedId) {
            const box = slice.items().find((b) => b.id === hit.interior);
            const ctxDrag = box ? wholeDragCtx(hit.interior, box, hit.x, hit.y) : null;
            if (ctxDrag) return { kind: "drag", channel: "whole", ctx: ctxDrag };
            return { kind: "done" };
          }

          // Click on a hovered box (corner/edge halo) selects it.
          if (hit.hovered != null) {
            kit.select(hit.hovered);
            return { kind: "done" };
          }

          // Interior of an unselected box: behaves like empty space (deselect).
          kit.select(null);
          return { kind: "ignore" };
        },

        channels: {
          corner: {
            preview(c, s) {
              if (c.kind !== "corner" || s.magnetPrice == null || s.time == null) return;
              const box = slice.items().find((b) => b.id === c.boxId);
              if (!box) return;
              let newP1 = { ...box.p1 };
              let newP2 = { ...box.p2 };
              if (c.corner === "p1") {
                newP1 = { price: s.magnetPrice, time: s.time };
              } else if (c.corner === "p2") {
                newP2 = { price: s.magnetPrice, time: s.time };
              } else if (c.corner === "p1price-p2time") {
                newP1 = { ...newP1, time: s.time };
                newP2 = { ...newP2, price: s.magnetPrice };
              } else {
                newP2 = { ...newP2, time: s.time };
                newP1 = { ...newP1, price: s.magnetPrice };
              }
              slice.update(c.boxId, { p1: newP1, p2: newP2 });
            },
            drop() {}, // live store updates are the drag; nothing to commit
            clear() {},
          },
          edge: {
            preview(c, s) {
              if (c.kind !== "edge") return;
              const box = slice.items().find((b) => b.id === c.boxId);
              if (!box) return;
              if (c.axis === "time") {
                if (s.time == null) return;
                slice.update(c.boxId, { [c.target]: { ...box[c.target], time: s.time } });
              } else {
                if (s.magnetPrice == null) return;
                slice.update(c.boxId, { [c.target]: { ...box[c.target], price: s.magnetPrice } });
              }
            },
            drop() {},
            clear() {},
          },
          whole: {
            preview(c, s) {
              if (c.kind !== "whole" || s.rawPrice == null || s.time == null) return;
              const priceDelta = s.rawPrice - c.startPrice;
              const timeDelta = s.time - c.startTime;
              slice.update(c.boxId, {
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
          const anchorY = series.priceToCoordinate(anchor.magnetPrice!);
          const anchorX = timeToCoordinateOrNearest(chart, anchor.time!) ?? s.x;
          const snapY = s.magnetPrice != null ? (series.priceToCoordinate(s.magnetPrice) ?? s.y) : s.y;
          if (anchorY == null) return;
          primitive.setPreview({
            left: Math.min(anchorX, s.x),
            top: Math.min(anchorY, snapY),
            right: Math.max(anchorX, s.x),
            bottom: Math.max(anchorY, snapY),
            style: { ...env.tools.getLastUsedBoxStyle() },
          });
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
      // Body is intentionally not hoverable/selectable — only corners and edges.
      const corner = primitive.cornerHitTest(x, y);
      const edge = !corner ? primitive.edgeHitTest(x, y) : null;
      return { id: corner ? corner.boxId : edge ? edge.boxId : null, precision: "corner" };
    },
  };
}
