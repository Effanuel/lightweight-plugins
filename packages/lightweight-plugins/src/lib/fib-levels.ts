/** One horizontal line of a fibonacci drawing. `color` unset means "use the drawing's style color". */
export type FibLevel = {
  value: number;
  visible: boolean;
  color?: string;
};

export const DEFAULT_FIB_LEVELS: FibLevel[] = [0, 1, 1.618, 2.618, 4.618, 8.618].map((value) => ({
  value,
  visible: true,
}));

/**
 * The levels a fib actually draws. An unset override (fibs stored before levels
 * were configurable) falls back to the defaults; an empty one draws nothing.
 */
export function visibleFibLevels(levels: FibLevel[] | undefined): FibLevel[] {
  return (levels ?? DEFAULT_FIB_LEVELS).filter((l) => l.visible);
}
