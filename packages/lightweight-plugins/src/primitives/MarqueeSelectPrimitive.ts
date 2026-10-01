import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import { crispRect, lineBitmapWidth } from "./chart-drawing";
import { DEFAULT_BOX_STYLE } from "../model";
import type { PixelRect } from "../lib/marquee-select";

type ViewData = { rect: PixelRect | null };

/**
 * Renders the live Ctrl+drag selection rectangle. The rect is stored in CSS
 * pane pixels (screen space) and only drawn during a drag — it is cleared on
 * mouseup, leaving only the per-drawing highlights. Styled like the box tool
 * so the marquee looks like any other box being drawn.
 */
class MarqueeSelectRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly viewData: ViewData) {}

  draw(target: CanvasRenderingTarget2D) {
    const { rect } = this.viewData;
    if (!rect) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const s = DEFAULT_BOX_STYLE;
      const strokeBm = lineBitmapWidth(s.borderWidth, hr);
      const r = crispRect(rect.minX * hr, rect.minY * vr, rect.maxX * hr, rect.maxY * vr, strokeBm);
      const l = r.left;
      const t = r.top;
      const w = r.right - r.left;
      const h = r.bottom - r.top;

      ctx.globalAlpha = s.bgOpacity;
      ctx.fillStyle = s.bgColor;
      ctx.fillRect(l, t, w, h);

      ctx.globalAlpha = s.borderOpacity;
      ctx.strokeStyle = s.borderColor;
      ctx.lineWidth = strokeBm;
      ctx.strokeRect(l, t, w, h);
      ctx.globalAlpha = 1;
    });
  }

  drawBackground() {}
}

class MarqueeSelectPaneView implements IPrimitivePaneView {
  private readonly viewData: ViewData = { rect: null };

  constructor(private readonly source: MarqueeSelectPrimitive) {}

  update() {
    this.viewData.rect = this.source.rect;
  }

  renderer() {
    return new MarqueeSelectRenderer(this.viewData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    // Draw above the crosshair and every drawing while the marquee is active.
    return "top";
  }
}

export class MarqueeSelectPrimitive implements ISeriesPrimitive<Time> {
  private readonly paneViewsInstance: MarqueeSelectPaneView[];
  private requestUpdateCallback: (() => void) | null = null;

  rect: PixelRect | null = null;

  constructor() {
    this.paneViewsInstance = [new MarqueeSelectPaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.requestUpdateCallback = param.requestUpdate;
  }

  detached() {
    this.rect = null;
    this.requestUpdateCallback = null;
  }

  autoscaleInfo() {
    return null;
  }

  paneViews() {
    return this.paneViewsInstance;
  }

  /** Set the live rubber-band rect (CSS pane pixels), or null to clear it. */
  setRect(rect: PixelRect | null) {
    this.rect = rect;
    this.refresh();
  }

  refresh() {
    for (const view of this.paneViewsInstance) view.update();
    this.requestUpdateCallback?.();
  }
}
