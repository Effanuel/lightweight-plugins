/**
 * The injected seam through which the gesture controller reaches the chart.
 * The production adapter wraps lightweight-charts; tests pass a fake so the
 * gesture state machine is the test surface (no chart mount).
 *
 * `S` is the sample a drag carries: a tick-snapped price for order-line drags,
 * a magnet-snapped `{price, time}` point for drawing-tool drags. The adapter
 * owns validity and snapping — `sampleAt` returns null for a coordinate that
 * can't become a valid sample, and the controller skips that move.
 */
export interface ChartGeometry<S = number> {
  /** Pane-local coords for a pointer event, or null if outside the plottable pane. */
  paneCoords(e: MouseEvent): { x: number; y: number } | null;
  /** Validated, snapped sample at pane coords, or null if it can't be resolved. */
  sampleAt(x: number, y: number): S | null;
  /** Toggle chart scroll/scale locking during a drag. */
  lockScroll(locked: boolean): void;
}

/** What a consumer's onHit returns to tell the controller how a hit resolves. */
export type GestureVerdict<Ctx> =
  | { kind: "done" } // instant action handled inline by the consumer
  | { kind: "ignore" } // not this consumer's hit
  | { kind: "drag"; channel: string; ctx: Ctx; onClick?: () => void };

/** Per-drag-kind behaviour behind a gesture's drag outcome. */
export interface DragChannel<Ctx, S = number> {
  /** Emit a live preview to the chart primitive on each move. */
  preview(ctx: Ctx, sample: S): void;
  /** Validate and dispatch on release — owns clearing its own preview. */
  drop(ctx: Ctx, sample: S): void;
  /** Clear any stray preview; called by the controller on no-op / teardown. */
  clear(ctx: Ctx): void;
}

export interface ChartGestureConfig<Hit, Ctx, S = number> {
  hitTest(x: number, y: number): Hit | null;
  /** Resolve a hit; receives the originating event (e.g. for altKey checks). */
  onHit(hit: Hit, e: MouseEvent): GestureVerdict<Ctx>;
  channels: Record<string, DragChannel<Ctx, S>>;
}

type ActiveDrag<Ctx> = {
  channel: string;
  ctx: Ctx;
  onClick?: () => void;
};

/**
 * Owns the chart gesture control-flow that was previously copy-pasted across
 * every chart-interaction hook: hit dispatch, scroll-lock during drag, the
 * click-vs-drop distinction, the consumed flag, and listener lifecycle. It
 * never owns the *effect* of an action — that lives in onHit (instant actions)
 * and the registered drag channels — nor the sample semantics, which live in
 * the ChartGeometry adapter.
 */
export class ChartGestureController<Hit, Ctx, S = number> {
  private active: ActiveDrag<Ctx> | null = null;
  private moved = false;
  private lastSample: S | null = null;
  private consumed = false;

  constructor(
    private readonly geometry: ChartGeometry<S>,
    private readonly config: ChartGestureConfig<Hit, Ctx, S>,
  ) {}

  handleMouseDown = (e: MouseEvent): void => {
    const coords = this.geometry.paneCoords(e);
    if (!coords) return;
    const hit = this.config.hitTest(coords.x, coords.y);
    if (hit === null) return;

    const verdict = this.config.onHit(hit, e);
    switch (verdict.kind) {
      case "ignore":
        return;
      case "done":
        e.preventDefault();
        return;
      case "drag":
        this.active = { channel: verdict.channel, ctx: verdict.ctx, onClick: verdict.onClick };
        this.moved = false;
        this.lastSample = null;
        this.geometry.lockScroll(true);
        e.preventDefault();
        return;
    }
  };

  handleMouseMove = (e: MouseEvent): void => {
    const active = this.active;
    if (!active) return;
    const coords = this.geometry.paneCoords(e);
    if (!coords) return; // off pane — skip without marking moved
    const sample = this.geometry.sampleAt(coords.x, coords.y);
    if (sample === null) return; // not a valid sample — skip

    this.moved = true;
    this.lastSample = sample;
    this.channel(active.channel)?.preview(active.ctx, sample);
  };

  handleMouseUp = (): void => {
    const active = this.active;
    if (!active) return;
    const moved = this.moved;
    const sample = this.lastSample;

    this.active = null;
    this.moved = false;
    this.lastSample = null;
    this.geometry.lockScroll(false);

    const channel = this.channel(active.channel);

    // moved ⟹ sample is valid+snapped (only set together in handleMouseMove)
    if (moved && sample !== null) {
      this.consumed = true;
      channel?.drop(active.ctx, sample); // drop owns its own clear (in-flight preview)
      return;
    }

    // no-move: a click, not a drop
    channel?.clear(active.ctx);
    active.onClick?.();
  };

  /**
   * Abort an in-flight drag without dropping (e.g. contextmenu during a drag):
   * clears the armed channel's preview, unlocks scroll, and never consumes.
   */
  cancelActive(): void {
    const active = this.active;
    if (!active) return;
    this.active = null;
    this.moved = false;
    this.lastSample = null;
    this.geometry.lockScroll(false);
    this.channel(active.channel)?.clear(active.ctx);
  }

  /** Whether a drag is currently armed (between a drag verdict and its release/cancel). */
  isActive(): boolean {
    return this.active !== null;
  }

  /** Read-and-reset: plugin.onChartClick uses this to swallow the click that ends a drag. */
  wasGestureConsumed(): boolean {
    const c = this.consumed;
    this.consumed = false;
    return c;
  }

  /** Wire the gesture to a container (mousedown) and document (move/up). Returns a teardown. */
  attach(container: HTMLElement, doc: Document): () => void {
    container.addEventListener("mousedown", this.handleMouseDown);
    doc.addEventListener("mousemove", this.handleMouseMove);
    doc.addEventListener("mouseup", this.handleMouseUp);
    return () => {
      container.removeEventListener("mousedown", this.handleMouseDown);
      doc.removeEventListener("mousemove", this.handleMouseMove);
      doc.removeEventListener("mouseup", this.handleMouseUp);
      this.geometry.lockScroll(false);
      this.active = null;
      this.moved = false;
      this.lastSample = null;
    };
  }

  private channel(name: string): DragChannel<Ctx, S> | undefined {
    return this.config.channels[name];
  }
}
