import type {
  ChartPlugin,
  ChartPluginContext,
  ClickResult,
  Teardown,
  ToolEnv,
} from "./chart-plugin";
import {
  ChartGestureController,
  type ChartGeometry,
  type DragChannel,
  type GestureVerdict,
} from "./chart-gesture";
import { createDrawingGeometry, type DrawingSample } from "./drawing-gesture-geometry";
import type { HoverPrecision } from "./drawing-hover";
import type { ToolName } from "../store/tool-state";
import { isTextEntryTarget } from "../lib/dom-events";

/** The per-type slice of the drawings store a tool operates on. */
export type StoreSlice<T extends { id: number }> = {
  items(): T[];
  add(item: T): void;
  update(id: number, patch: Partial<Omit<T, "id">>): void;
  remove(id: number): void;
};

/** What the settings popup binds to: the selected drawing and where to place itself. */
export type SelectedDrawing<TStyle> = { id: number; style: TStyle; y: number };

/**
 * The uniform surface the harness needs from a drawing primitive. Where
 * primitive method names differ per tool (getSelectedBox / getSelectedTrend /
 * …), the tool supplies one-line lambdas.
 */
export type DrawingPrimitiveAdapter<T> = {
  select(id: number | null): void;
  selectedId(): number | null;
  selectedItem(): T | null;
  selectedY(): number | null;
  setDragging(dragging: boolean): void;
  setHovered(id: number | null): void;
  applyData(items: T[]): void;
};

/**
 * The Creation Flow — how an armed tool turns pointer input into a stored
 * drawing. One-click stores on the first click; two-click anchors then
 * finalizes (Escape / contextmenu cancels the anchor); custom hands the raw
 * events to the tool (multi-click path building).
 */
export type CreationSpec<T, TStyle> =
  | {
      mode: "one-click";
      /** Cursor-follow preview while the tool is armed, before the click. */
      preview?(s: DrawingSample): void;
      clearPreview?(): void;
      /** Build the item to store, or null to ignore the click (e.g. unresolvable sample). */
      create(s: DrawingSample, id: number, style: TStyle): T | null;
    }
  | {
      mode: "two-click";
      /** Reject an unusable first click (e.g. unresolvable sample); tool stays armed. */
      acceptAnchor?(s: DrawingSample): boolean;
      previewStep(anchor: DrawingSample, s: DrawingSample): void;
      clearPreview(): void;
      /** Null keeps the anchor and the tool armed (unusable second click). */
      create(anchor: DrawingSample, s: DrawingSample, id: number, style: TStyle): T | null;
    }
  | {
      mode: "custom";
      /** Whether this mount owns an in-progress custom build. */
      hasPending?(): boolean;
      /** Return true when the click did something — false lets it propagate. */
      onMouseDown(e: MouseEvent, s: DrawingSample): boolean;
      onMouseMove?(e: MouseEvent, s: DrawingSample): void;
      /** Cancel any in-progress build (Escape / contextmenu / teardown). */
      cancel(): void;
    };

export type GestureSpec<Hit, DragCtx> = {
  hitTest(x: number, y: number): Hit | null;
  onHit(hit: Hit, e: MouseEvent): GestureVerdict<DragCtx>;
  channels: Record<string, DragChannel<DragCtx, DrawingSample>>;
};

/** Harness helpers handed to the per-mount builders. */
export type DrawingToolKit = {
  select(id: number | null): void;
};

export type DrawingToolConfig<T extends { id: number; style: TStyle }, TStyle, Hit, DragCtx> = {
  /** The manager's stores, tick size, hover arbiter and keyboard gate. */
  env: ToolEnv;
  /** ChartPlugin name, e.g. "box-tool". */
  name: string;
  /** The chart-tools-store id that arms this tool, e.g. "box". */
  tool: ToolName;
  primitive: DrawingPrimitiveAdapter<T>;
  /** The series primitives the chart mounts (usually the one drawing primitive). */
  primitives(): ReturnType<ChartPlugin["primitives"]>;
  slice: StoreSlice<T>;
  /** Last-used style access for this tool's slot. */
  style: { get(): TStyle; remember(patch: Partial<TStyle>): void };
  /** Built once per mount; closes over the mount's chart context. */
  gesture(ctx: ChartPluginContext, kit: DrawingToolKit): GestureSpec<Hit, DragCtx>;
  /** Built once per mount; closes over the mount's chart context. */
  creation(ctx: ChartPluginContext, kit: DrawingToolKit): CreationSpec<T, TStyle>;
  /** Hover candidate under the cursor when idle (no drag, no armed tool). */
  hover(x: number, y: number): { id: number | null; precision: HoverPrecision };
  /** Injected seam for tests; production defaults to createDrawingGeometry. */
  geometry?(ctx: ChartPluginContext): ChartGeometry<DrawingSample>;
  /** Extra per-mount wiring (e.g. stashing the container for text measuring). */
  onMountEffect?(ctx: ChartPluginContext): (() => void) | void;
};

export type DrawingToolApi<TStyle> = {
  plugin: ChartPlugin;
  select(id: number | null): void;
  handleStyleChange(patch: Partial<TStyle>): void;
  /**
   * Runs `fn` inside the open popup's undo step, for popup edits made outside
   * the harness (fib levels, volume-median settings): everything changed while
   * one selection's popup stays open is one step, style changes included.
   */
  editSelected(fn: () => void): void;
  /** Remove the selected drawing from this tool's slice (the popup's Delete). */
  deleteSelected(): void;
  closePopup(): void;
  getSelected(): SelectedDrawing<TStyle> | null;
  onSelectionChange(cb: (sel: SelectedDrawing<TStyle> | null) => void): () => void;
};

// Popup sessions are numbered across every harness instance, so two popups
// (e.g. two instances of one tool) never share a merge key.
let nextSession = 0;

/**
 * The drawing-tool harness. Owns everything the ten tool hooks used to
 * copy-paste — selection state, style changes + last-used memory, the
 * Creation Flow, Escape/Delete, hover reporting, store sync (incl. hidden),
 * and listener lifecycle — and delegates drag control-flow to a
 * ChartGestureController over DrawingSamples. Tools supply only behaviour:
 * hit tests, verdicts, drag channels, creation, hover. It also groups undo:
 * a gesture is one step, and so is a popup session.
 *
 * Pure factory so the whole module tests through this interface with fakes;
 * the manager owns mounting.
 */
export function createDrawingToolPlugin<T extends { id: number; style: TStyle }, TStyle, Hit, DragCtx>(
  config: DrawingToolConfig<T, TStyle, Hit, DragCtx>,
): DrawingToolApi<TStyle> {
  const { primitive, slice, env } = config;

  let selected: SelectedDrawing<TStyle> | null = null;
  const listeners = new Set<(sel: SelectedDrawing<TStyle> | null) => void>();
  // The popup positions itself in the container, but selectedY is pane-local;
  // set per mount from the pane element, if any (else 0).
  let paneTop = () => 0;
  // Popup edits happen outside onMount, so they need the pane captured there.
  let mounted = false;
  // Every popup edit under one session merges into one undo step; any change
  // of the selected id (open, switch, close) starts a new session.
  let session = 0;

  const notify = () => {
    for (const cb of listeners) cb(selected);
  };

  const select = (id: number | null) => {
    if (id !== primitive.selectedId()) session = ++nextSession;
    primitive.select(id);
    if (id == null) {
      if (selected !== null) {
        selected = null;
        notify();
      }
      return;
    }
    const item = primitive.selectedItem();
    const y = primitive.selectedY();
    if (item && y != null) {
      selected = { id: item.id, style: item.style, y: y + paneTop() };
      notify();
    }
  };

  const deleteSelected = () => {
    const id = primitive.selectedId();
    if (id == null) return;
    slice.remove(id);
    select(null);
  };

  // Unmounted there is no pane to key the step on, but no popup either
  // (teardown deselects): `fn` just runs, and each write is its own step.
  const editSelected = (fn: () => void) => {
    if (!mounted) return fn();
    env.drawings.edit(fn, `popup:${session}`);
  };

  const handleStyleChange = (patch: Partial<TStyle>) =>
    editSelected(() => {
      const id = primitive.selectedId();
      if (id == null) return;
      const item = slice.items().find((it) => it.id === id);
      if (!item) return;
      const newStyle = { ...item.style, ...patch };
      slice.update(id, { style: newStyle } as Partial<Omit<T, "id">>);
      config.style.remember(patch);
      if (selected?.id === id) {
        selected = { ...selected, style: newStyle };
        notify();
      }
    });

  const isArmed = () => env.tools.activeTool === config.tool;
  const disarm = () => env.tools.clearTool();

  const plugin: ChartPlugin = {
    name: config.name,
    clickPriority: 200,

    primitives() {
      return config.primitives();
    },

    onChartClick(): ClickResult {
      return isArmed() ? "consumed" : "pass";
    },

    onMount(ctx: ChartPluginContext): Teardown {
      const geometry = config.geometry?.(ctx) ?? createDrawingGeometry(ctx, env.tickSize);
      const kit: DrawingToolKit = { select };
      const gesture = config.gesture(ctx, kit);
      const creation = config.creation(ctx, kit);
      const mountCleanup = config.onMountEffect?.(ctx);
      paneTop = () => {
        const el = ctx.paneEl?.();
        return el ? el.getBoundingClientRect().top - ctx.container.getBoundingClientRect().top : 0;
      };
      mounted = true;

      const controller = new ChartGestureController<Hit, DragCtx, DrawingSample>(geometry, {
        hitTest: gesture.hitTest,
        onHit: gesture.onHit,
        channels: gesture.channels,
      });

      // Two-click creation state: the first click's sample.
      let anchor: DrawingSample | null = null;
      // Whether an armed drag holds an undo step open (mousedown to release).
      let dragEdit = false;

      const endDragEdit = () => {
        if (!dragEdit) return;
        dragEdit = false;
        env.drawings.endEdit();
      };

      const clearAnchor = () => {
        if (creation.mode !== "two-click") return;
        anchor = null;
        creation.clearPreview();
        geometry.lockScroll(false);
      };

      const cancelCreation = () => {
        if (creation.mode === "one-click") creation.clearPreview?.();
        if (creation.mode === "two-click") clearAnchor();
        if (creation.mode === "custom") creation.cancel();
        disarm();
      };

      const finishCreate = (item: T | null) => {
        if (!item) return;
        slice.add(item);
        disarm();
        select(item.id);
      };

      const handleCreationMouseDown = (e: MouseEvent, coords: { x: number; y: number }) => {
        const sample = geometry.sampleAt(coords.x, coords.y);
        if (sample === null) return;

        if (creation.mode === "custom") {
          if (!creation.onMouseDown(e, sample)) return; // unresolvable click — let it propagate
        } else if (creation.mode === "one-click") {
          const item = creation.create(sample, env.drawings.generateId(), { ...config.style.get() });
          if (item === null) return; // unresolvable click — tool stays armed, event propagates
          creation.clearPreview?.();
          finishCreate(item);
        } else if (anchor === null) {
          if (creation.acceptAnchor && !creation.acceptAnchor(sample)) return;
          anchor = sample;
          creation.clearPreview();
          geometry.lockScroll(true);
        } else {
          const item = creation.create(anchor, sample, env.drawings.generateId(), {
            ...config.style.get(),
          });
          if (item === null) return; // unusable second click — keep the anchor
          clearAnchor();
          finishCreate(item);
        }
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0 || e.defaultPrevented) return;
        const coords = geometry.paneCoords(e);
        if (!coords) {
          // Off the drawing area (an axis, say): drawings share one
          // container, so drop the selection here or Delete would remove a
          // drawing on each of them.
          if (primitive.selectedId() != null) select(null);
          return;
        }

        if (isArmed()) {
          handleCreationMouseDown(e, coords);
          return;
        }
        // Never react while another tool is armed.
        if (env.tools.activeTool != null) return;

        if (gesture.hitTest(coords.x, coords.y) === null) {
          // Empty-pane click: dismiss any single selection.
          if (primitive.selectedId() != null) select(null);
          return;
        }

        // A gesture is one undo step. It opens before the hit is dispatched:
        // alt+drag clones inside onHit, and the clone and its move must undo
        // together. A drag whose release never arrived is closed first.
        endDragEdit();
        env.drawings.beginEdit();
        controller.handleMouseDown(e);
        if (controller.isActive()) {
          dragEdit = true;
          primitive.setDragging(true);
        } else {
          env.drawings.endEdit(); // an instant action: its own step, or nothing
        }
        if (e.defaultPrevented) e.stopImmediatePropagation();
      };

      const onMouseLeave = () => {
        if (creation.mode === "one-click") creation.clearPreview?.();
        if (creation.mode === "two-click" && anchor !== null) creation.clearPreview();
        env.reportHover(primitive.setHovered, null);
      };

      const onContainerMouseMove = (e: MouseEvent) => {
        const coords = geometry.paneCoords(e);
        if (!coords) {
          onMouseLeave(); // left the drawing area, even if still in the container
          return;
        }

        if (isArmed()) {
          const sample = geometry.sampleAt(coords.x, coords.y);
          if (sample === null) return;
          if (creation.mode === "one-click") creation.preview?.(sample);
          if (creation.mode === "two-click" && anchor !== null) creation.previewStep(anchor, sample);
          if (creation.mode === "custom") creation.onMouseMove?.(e, sample);
          return;
        }

        if (!controller.isActive() && env.tools.activeTool == null) {
          const { id, precision } = config.hover(coords.x, coords.y);
          env.reportHover(primitive.setHovered, id, precision);
        }
      };

      const onMouseUp = () => {
        if (!controller.isActive()) return;
        controller.handleMouseUp();
        primitive.setDragging(false);
        endDragEdit(); // after the drop: its writes (a vmedian's rescan) belong to the step
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (!env.keysActive()) return;
        // A key press inside a text field belongs to that field. This handler
        // is bound on the document, so without this the fib level editor's
        // inputs — which sit in a popup outside the chart container — send
        // every Backspace here, and the drawing being edited is exactly the
        // one that is selected. Guards the whole handler, not just the delete
        // branch: Escape inside a level input should not deselect either.
        if (isTextEntryTarget(e.target)) return;

        if (e.key === "Escape") {
          const pending = creation.mode === "two-click"
            ? anchor !== null
            : creation.mode === "custom"
              ? creation.hasPending?.() ?? false
              : false;
          if (pending) cancelCreation();
          else if (creation.mode === "one-click" && isArmed()) {
            creation.clearPreview?.();
            disarm();
          }
          select(null);
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          if (primitive.selectedId() != null) {
            deleteSelected();
            e.preventDefault();
          }
        }
      };

      const onContextMenu = (e: MouseEvent) => {
        if (controller.isActive()) {
          controller.cancelActive();
          primitive.setDragging(false);
          endDragEdit(); // the store is the preview, so what moved stays: keep it as a step
        }
        if (!isArmed()) return;
        e.preventDefault();
        cancelCreation();
      };

      const syncPrimitive = () => {
        primitive.applyData(env.drawings.isHidden() ? [] : slice.items());
      };
      syncPrimitive();
      const unsubDrawings = env.drawings.subscribe((s, prev) => {
        // An undo/redo may have changed or removed the selected drawing: drop
        // the selection (closing the popup). Runs inside the store's set, so
        // nothing here may write drawings.
        if (s.historyVersion !== prev.historyVersion) select(null);
        syncPrimitive();
      });

      const { container } = ctx;
      const doc = container.ownerDocument;
      const win = doc.defaultView!;
      container.addEventListener("mousedown", onMouseDown);
      container.addEventListener("mousemove", onContainerMouseMove);
      container.addEventListener("mouseleave", onMouseLeave);
      container.addEventListener("contextmenu", onContextMenu);
      // Move on the document, release on the window: drags may leave the pane.
      doc.addEventListener("mousemove", controller.handleMouseMove);
      win.addEventListener("mouseup", onMouseUp);
      doc.addEventListener("keydown", onKeyDown);

      return () => {
        controller.cancelActive();
        endDragEdit();
        if (creation.mode === "one-click") creation.clearPreview?.();
        clearAnchor();
        if (creation.mode === "custom") creation.cancel();
        select(null); // the primitive is about to detach; a stale popup would outlive it
        paneTop = () => 0;
        mounted = false;
        mountCleanup?.();
        unsubDrawings();
        container.removeEventListener("mousedown", onMouseDown);
        container.removeEventListener("mousemove", onContainerMouseMove);
        container.removeEventListener("mouseleave", onMouseLeave);
        container.removeEventListener("contextmenu", onContextMenu);
        doc.removeEventListener("mousemove", controller.handleMouseMove);
        win.removeEventListener("mouseup", onMouseUp);
        doc.removeEventListener("keydown", onKeyDown);
      };
    },
  };

  return {
    plugin,
    select,
    handleStyleChange,
    editSelected,
    deleteSelected,
    closePopup: () => select(null),
    getSelected: () => selected,
    onSelectionChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
