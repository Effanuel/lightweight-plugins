import type {
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import { priceConverter, type PriceConverter } from "../lib/chart-measure";

/**
 * Shared lifecycle/selection/refresh state for the drawing primitives.
 *
 * Holds the boilerplate that every primitive duplicated: chart/series wiring,
 * the selection trio (selectedId/hoveredId/marqueeIds), the drag flag, and the
 * refresh/updateAllViews loop. Subclasses provide their pane views and their
 * data + hit-tests, and may override `resetState()` to clear tool-specific
 * fields on detach.
 *
 * The public surface (select/setHovered/setMarqueeIds/setDragging/refresh/
 * updateAllViews/autoscaleInfo/paneViews/attached/detached) is identical to the
 * pre-refactor primitives, so the hooks that drive them need no changes.
 */
/** A pane view that the primitive re-syncs on every refresh. */
export type UpdatablePaneView = IPrimitivePaneView & { update(): void };

export abstract class DrawingPrimitiveBase<TView extends UpdatablePaneView = UpdatablePaneView>
  implements ISeriesPrimitive<Time>
{
  chart: SeriesAttachedParameter<Time>["chart"] | null = null;
  // A converter, not the attached series: the primitives only ever ask it for
  // price↔pixel, and in range mode the candlestick series they hang off is
  // empty and answers null. See priceConverter.
  series: PriceConverter | null = null;
  protected requestUpdateCallback: (() => void) | null = null;

  selectedId: number | null = null;
  hoveredId: number | null = null;
  marqueeIds: ReadonlySet<number> = new Set();
  dragging = false;

  /** Pane views owned by the subclass (constructed in its constructor). */
  protected abstract readonly paneViewsInstance: TView[];

  /**
   * Clear tool-specific transient state (previews, building points, container).
   * Called from `detached()` after the shared state is reset. Default no-op.
   */
  protected resetState(): void {}

  attached(param: SeriesAttachedParameter<Time>) {
    this.chart = param.chart;
    this.series = priceConverter(param.chart, param.series);
    this.requestUpdateCallback = param.requestUpdate;
  }

  detached() {
    this.selectedId = null;
    this.marqueeIds = new Set();
    this.dragging = false;
    this.resetState();
    this.chart = null;
    this.series = null;
    this.requestUpdateCallback = null;
  }

  autoscaleInfo() {
    return null;
  }

  paneViews(): readonly TView[] {
    return this.paneViewsInstance;
  }

  select(id: number | null) {
    this.selectedId = id;
    this.refresh();
  }

  /** Highlight every drawing in `ids` as part of a marquee multi-selection. */
  setMarqueeIds(ids: ReadonlySet<number>) {
    this.marqueeIds = ids;
    this.refresh();
  }

  setHovered(id: number | null) {
    if (this.hoveredId === id) return;
    this.hoveredId = id;
    this.refresh();
  }

  /** While true, pane views render above the crosshair (zOrder "top"). */
  setDragging(dragging: boolean) {
    if (this.dragging === dragging) return;
    this.dragging = dragging;
    this.refresh();
  }

  refresh() {
    this.updateAllViews();
    this.requestUpdateCallback?.();
  }

  updateAllViews() {
    for (const view of this.paneViewsInstance) {
      view.update();
    }
  }
}

/** The minimum every persisted drawing carries: a stable id selection keys off. */
export type Identified = { id: number };

/**
 * A drawing primitive whose items persist and can be selected — every tool
 * except the measuring overlays, which draw transient chrome with nothing
 * selectable in it and so stay on the plain base.
 *
 * Subclasses store their items under their own name (`lines`, `boxes`,
 * `fibs`, ...) and name the price the settings popup should hang off; the
 * lookup and the pixel conversion live here once.
 */
export abstract class SelectableDrawingPrimitive<
  TView extends UpdatablePaneView = UpdatablePaneView,
  TItem extends Identified = Identified,
> extends DrawingPrimitiveBase<TView> {
  /** Every drawing this primitive holds. */
  protected abstract items(): ReadonlyArray<TItem>;

  /**
   * The price the settings popup anchors to, or null when the item has no
   * usable anchor (an empty point list). Tools differ: a two-point box hangs
   * off its top edge, a trend line off its lower end, a path off its first
   * point.
   */
  protected abstract anchorPrice(item: TItem): number | null;

  /** The selected drawing, or null. */
  getSelected(): TItem | null {
    if (this.selectedId == null) return null;
    return this.items().find((i) => i.id === this.selectedId) ?? null;
  }

  /** Y coordinate of the selected drawing's anchor — positions the popup. */
  getSelectedY(): number | null {
    const item = this.getSelected();
    if (!item || !this.series) return null;
    const price = this.anchorPrice(item);
    if (price == null) return null;
    return this.series.priceToCoordinate(price) ?? null;
  }
}
