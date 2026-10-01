import type { ChartPlugin, ChartPluginContext, Teardown, ToolEnv } from "../harness/chart-plugin";
import { MarqueeSelectPrimitive } from "../primitives/MarqueeSelectPrimitive";
import { DRAWING_KINDS, type DrawingKind } from "../model";
import { getChartPaneCoords } from "../lib/chart-measure";
import { rectFromPoints, rectIsMeaningful, type PixelRect } from "../lib/marquee-select";
import { CLONE_BY_KIND, offsetFromVisibleRange } from "../lib/drawing-clone";
import { createClipboard, emptySelection as emptyClipboardSelection, type DrawingSelection } from "../lib/drawing-clipboard";
import { isTextEntryTarget } from "../lib/dom-events";

export interface MarqueeablePrimitive {
  setMarqueeIds(ids: ReadonlySet<number>): void;
  getEnclosedIds(rect: PixelRect): number[];
  selectedId: number | null;
}

type Selection = Record<DrawingKind, Set<number>>;

const emptySelection = (): Selection =>
  Object.fromEntries(DRAWING_KINDS.map((k) => [k, new Set<number>()])) as Selection;

export type MarqueeTool = {
  plugin: ChartPlugin;
  selection(): Record<DrawingKind, ReadonlySet<number>>;
  clear(): void;
  /** Copies the marquee + single selections; false when nothing is selected. */
  copy(): boolean;
  /** Pastes offset clones as one undo step and selects them; false with an empty clipboard or before mount. */
  paste(): boolean;
  /** Deletes the marquee selection as one undo step; false when it is empty. */
  deleteSelection(): boolean;
  onChange(cb: () => void): () => void;
};

/**
 * Marquee multi-select, copy/paste and multi-delete: terminal's
 * useMarqueeSelectPlugin without React and app stores. Ctrl/Cmd+drag from any
 * mode, or plain drag with the "select" tool. Mount it before the drawing
 * tools: its mousedown and keydown listeners must run first, because it stops
 * propagation to claim a Ctrl+drag and a multi-selection Delete.
 */
export function createMarqueeTool(env: ToolEnv, primitives: Record<DrawingKind, MarqueeablePrimitive>): MarqueeTool {
  const marquee = new MarqueeSelectPrimitive();
  const clipboard = createClipboard();
  const listeners = new Set<() => void>();
  let selection: Selection = emptySelection();
  let mountedCtx: ChartPluginContext | null = null;

  const setSelection = (sel: Selection) => {
    selection = sel;
    for (const k of DRAWING_KINDS) primitives[k].setMarqueeIds(sel[k]);
    for (const cb of [...listeners]) cb();
  };
  const hasSelection = () => DRAWING_KINDS.some((k) => selection[k].size > 0);
  const clear = () => {
    if (hasSelection()) setSelection(emptySelection());
  };

  // Union of the marquee selection and any per-tool single selection.
  const gatherSelection = (): DrawingSelection => {
    const out = emptyClipboardSelection();
    for (const k of DRAWING_KINDS) {
      const ids = new Set<number>(selection[k]);
      const single = primitives[k].selectedId;
      if (single != null) ids.add(single);
      // @ts-expect-error index access is sound: items(k) returns DrawingDataMap[k][]
      out[k] = env.drawings.items(k).filter((d) => ids.has(d.id));
    }
    return out;
  };

  const copy = () => {
    const sel = gatherSelection();
    if (DRAWING_KINDS.every((k) => sel[k].length === 0)) return false;
    clipboard.set(sel);
    return true;
  };

  const paste = () => {
    const clip = clipboard.get();
    if (!clip || !mountedCtx || !clipboard.has()) return false;
    const offset = offsetFromVisibleRange(mountedCtx);
    const next = emptySelection();
    env.drawings.edit(() => {
      for (const k of DRAWING_KINDS) {
        for (const item of clip[k]) {
          const id = env.drawings.generateId();
          // @ts-expect-error CLONE_BY_KIND[k] and add(k) share the same DrawingDataMap[k]
          env.drawings.add(k, CLONE_BY_KIND[k](item, id, offset));
          next[k].add(id);
        }
      }
    });
    setSelection(next);
    return true;
  };

  const deleteSelection = () => {
    if (!hasSelection()) return false;
    const sel = selection;
    env.drawings.edit(() => {
      for (const k of DRAWING_KINDS) sel[k].forEach((id) => env.drawings.remove(k, id));
    });
    clear();
    return true;
  };

  const plugin: ChartPlugin = {
    name: "marquee-select",
    // Above the drawing tools (200) so a Ctrl+drag is claimed before they react.
    clickPriority: 300,

    primitives() {
      return [marquee];
    },

    onMount(ctx: ChartPluginContext): Teardown {
      const { chart, container } = ctx;
      mountedCtx = ctx;
      let drag: { startX: number; startY: number } | null = null;

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0 || e.defaultPrevented) return;
        const modifier = e.ctrlKey || e.metaKey;
        if (!modifier && env.tools.activeTool !== "select") {
          clear(); // a plain click dismisses the marquee selection
          return;
        }
        const pos = getChartPaneCoords(e, container);
        if (pos.x >= chart.timeScale().width()) return; // the price axis
        clear();
        drag = { startX: pos.x, startY: pos.y };
        marquee.setRect({ minX: pos.x, minY: pos.y, maxX: pos.x, maxY: pos.y });
        env.lockScroll(true);
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!drag) return;
        const pos = getChartPaneCoords(e, container);
        marquee.setRect(rectFromPoints(drag.startX, drag.startY, pos.x, pos.y));
      };

      const onMouseUp = (e: MouseEvent) => {
        if (!drag) return;
        const pos = getChartPaneCoords(e, container);
        const rect = rectFromPoints(drag.startX, drag.startY, pos.x, pos.y);
        drag = null;
        marquee.setRect(null);
        env.lockScroll(false);
        if (!rectIsMeaningful(rect)) return; // a tiny drag is a click
        const sel = emptySelection();
        for (const k of DRAWING_KINDS) sel[k] = new Set(primitives[k].getEnclosedIds(rect));
        setSelection(sel);
        // The "select" tool is single-use, like the drawing tools; Ctrl+drag never touches it.
        if (env.tools.activeTool === "select") env.tools.clearTool();
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (!env.keysActive() || isTextEntryTarget(e.target)) return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && (e.key === "c" || e.key === "C")) {
          // Text selected on the page: that is what the user is copying.
          const pageSelection = container.ownerDocument.getSelection();
          if (pageSelection && !pageSelection.isCollapsed) return;
          if (copy()) e.preventDefault(); // nothing selected → native copy runs
          return;
        }
        if (mod && (e.key === "v" || e.key === "V")) {
          if (paste()) e.preventDefault();
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          if (!deleteSelection()) return;
          e.preventDefault();
          // The marquee owns this Delete: the tools must not also delete their single selection.
          e.stopImmediatePropagation();
        } else if (e.key === "Escape") {
          clear();
          if (env.tools.activeTool === "select") env.tools.clearTool();
        }
      };

      // An undo/redo/load may have removed selected drawings: drop the selection and any drag.
      const unsubHistory = env.drawings.subscribe((s, prev) => {
        if (s.historyVersion === prev.historyVersion) return;
        if (drag) {
          drag = null;
          marquee.setRect(null);
          env.lockScroll(false);
        }
        clear();
      });

      const doc = container.ownerDocument;
      const win = doc.defaultView!;
      container.addEventListener("mousedown", onMouseDown);
      container.addEventListener("mousemove", onMouseMove);
      win.addEventListener("mouseup", onMouseUp);
      doc.addEventListener("keydown", onKeyDown);

      return () => {
        unsubHistory();
        if (drag) env.lockScroll(false);
        clear();
        mountedCtx = null;
        container.removeEventListener("mousedown", onMouseDown);
        container.removeEventListener("mousemove", onMouseMove);
        win.removeEventListener("mouseup", onMouseUp);
        doc.removeEventListener("keydown", onKeyDown);
      };
    },
  };

  return {
    plugin,
    selection: () => selection,
    clear,
    copy,
    paste,
    deleteSelection,
    onChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
