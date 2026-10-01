export type DrawingPattern = "solid" | "dashed" | "dotted";

export type DrawingStyle = {
  width: number;
  color: string;
  pattern: DrawingPattern;
  opacity: number;
};

export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  width: 1,
  color: "#ffffff",
  pattern: "solid",
  opacity: 1,
};

/**
 * Dash runs as a multiple of the stroke width, so a dash grows with the
 * configured width instead of staying a fixed pixel constant. lightweight-
 * charts' own `setLineStyle` builds every run this way, but with equal on/off
 * runs for both its Dotted (`[lw, lw]`) and its Dashed (`[2 * lw, 2 * lw]`) —
 * which at 1px makes the two read as the same pattern at different scales.
 * "dashed" is therefore 2:1 here: the stroke runs twice as long as the gap,
 * which is what distinguishes a dash from a dot at any width. "dotted" stays
 * square.
 */
export const DASH_MULTIPLIERS: Record<DrawingPattern, number[]> = {
  solid: [],
  dashed: [4, 2],
  dotted: [1, 1],
};

/**
 * Dash runs in bitmap pixels for `pattern`. `strokeBm` is the stroke width
 * along the axis the dashes travel — the horizontal bitmap width for a line
 * that runs horizontally, the vertical one for a line that runs vertically.
 */
export function dashPattern(pattern: DrawingPattern, strokeBm: number): number[] {
  const run = Math.max(1, strokeBm);
  return DASH_MULTIPLIERS[pattern].map((m) => m * run);
}

/** Accent color for selection handles / highlighted drawing state. */
export const SELECTION_COLOR = "#2962ff";
