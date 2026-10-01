import type { CandlestickData } from "lightweight-charts";
import { DEFAULT_BOX_STYLE, DEFAULT_DRAWING_STYLE, type Drawing } from "@vecordis/lightweight-plugins";

/** A horizontal line, trend line, box and Fibonacci placed on the seeded candles. */
export function seedDrawings(candles: CandlestickData[]): Drawing[] {
  const t = (i: number) => candles[i].time as number;
  const n = candles.length;
  const lows = candles.slice(n - 45, n - 25).map((c) => c.low);
  const highs = candles.slice(n - 45, n - 25).map((c) => c.high);
  return [
    { kind: "h-line", id: 1, price: Number(candles[n - 1].close.toFixed(2)), time: t(n - 1), style: { ...DEFAULT_DRAWING_STYLE, color: "#ff9800", pattern: "dashed" } },
    { kind: "trend", id: 2, p1: { price: candles[n - 80].low, time: t(n - 80) }, p2: { price: candles[n - 50].high, time: t(n - 50) }, style: { ...DEFAULT_DRAWING_STYLE, color: "#2962ff", width: 2 } },
    { kind: "box", id: 3, p1: { price: Math.max(...highs), time: t(n - 45) }, p2: { price: Math.min(...lows), time: t(n - 25) }, style: { ...DEFAULT_BOX_STYLE } },
    { kind: "fibonacci", id: 4, p1: { price: candles[n - 20].high, time: t(n - 20) }, p2: { price: candles[n - 8].low, time: t(n - 8) }, style: { ...DEFAULT_DRAWING_STYLE, color: "#089981" } },
  ];
}
