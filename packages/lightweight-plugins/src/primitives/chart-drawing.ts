/** Shared canvas drawing utilities for chart primitives. */

import { SELECTION_COLOR } from "../lib/drawing-style";

export const FONT_SIZE = 13;
export const CIRCLE_R = 3.5;

export function setFont(ctx: CanvasRenderingContext2D, hr: number): void {
  ctx.font = `bold ${Math.round(FONT_SIZE * hr)}px monospace`;
}

/** Derive the number of decimal places from a tick size (e.g. 0.05 → 2, 0.5 → 1, 1 → 0). */
export function tickDecimals(tickSize: number): number {
  if (tickSize >= 1) return 0;
  const s = tickSize.toString();
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}

/** Format a price with consistent decimal places based on tick size. */
export function formatChartPrice(price: number, tickSize: number): string {
  const decimals = tickDecimals(tickSize);
  return price.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Convert a media-space line width to a whole number of bitmap pixels (min 1). */
export function lineBitmapWidth(widthMedia: number, pixelRatio: number): number {
  return Math.max(1, Math.round(widthMedia * pixelRatio));
}

/**
 * Snap a horizontal line's center Y so the stroke covers whole bitmap pixels.
 * Without this, fractional coordinates from priceToCoordinate make a 1px line
 * anti-alias across two pixel rows and flicker between faded and crisp while
 * the price axis is being dragged.
 * The math is axis-agnostic — pass an X coordinate to snap a vertical line.
 */
export function crispLineCenterY(yBm: number, widthBm: number): number {
  const topEdge = Math.round(yBm) - Math.floor(widthBm / 2);
  return topEdge + widthBm / 2;
}

/**
 * Snap a rectangle's edges so a border stroke of strokeBm covers whole bitmap
 * pixels. The returned edges are stroke-center coordinates; pass them directly
 * to ctx.strokeRect and ctx.fillRect. Note that strokeRect centers the stroke
 * on these edges, so half the stroke width falls outside the filled area.
 * strokeBm = 0 means fill-only: edges snap to integer pixel boundaries.
 */
export function crispRect(
  leftBm: number,
  topBm: number,
  rightBm: number,
  bottomBm: number,
  strokeBm: number,
): { left: number; top: number; right: number; bottom: number } {
  if (strokeBm <= 0) {
    return {
      left: Math.round(leftBm),
      top: Math.round(topBm),
      right: Math.round(rightBm),
      bottom: Math.round(bottomBm),
    };
  }
  return {
    left: crispLineCenterY(leftBm, strokeBm),
    top: crispLineCenterY(topBm, strokeBm),
    right: crispLineCenterY(rightBm, strokeBm),
    bottom: crispLineCenterY(bottomBm, strokeBm),
  };
}

/** A lightweight price-axis label for use with ISeriesPrimitive.priceAxisViews(). */
export class PriceAxisLabel {
  constructor(
    private readonly _coordinate: number,
    private readonly _text: string,
    private readonly _textColor: string,
    private readonly _backColor: string,
    private readonly _fixed: boolean = false,
  ) {}

  coordinate(): number {
    return this._fixed ? -10000 : this._coordinate;
  }

  fixedCoordinate(): number | undefined {
    return this._fixed ? this._coordinate : undefined;
  }

  text(): string {
    return this._text;
  }

  textColor(): string {
    return this._textColor;
  }

  backColor(): string {
    return this._backColor;
  }
}

/** Draw a selection handle dot: black fill with blue border. */
export function drawSelectionDot(
  ctx: CanvasRenderingContext2D,
  xBm: number,
  yBm: number,
  hr: number,
): void {
  const r = 5 * hr;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(xBm, yBm, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 2 * hr;
  ctx.beginPath();
  ctx.arc(xBm, yBm, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** Draw a small filled circle at the price axis edge. */
export function drawFilledCircle(
  ctx: CanvasRenderingContext2D,
  xBm: number,
  yBm: number,
  hr: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(xBm, yBm, CIRCLE_R * hr, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A lightweight time-axis label for use with ISeriesPrimitive.timeAxisViews().
 * Note: `fixedCoordinate()` is intentionally not implemented — all labels use automatic placement, unlike `PriceAxisLabel`.
 */
export class TimeAxisLabel {
  constructor(
    private readonly _coordinate: number,
    private readonly _text: string,
    private readonly _textColor: string,
    private readonly _backColor: string,
  ) {}

  coordinate(): number {
    return this._coordinate;
  }

  text(): string {
    return this._text;
  }

  textColor(): string {
    return this._textColor;
  }

  backColor(): string {
    return this._backColor;
  }
}
