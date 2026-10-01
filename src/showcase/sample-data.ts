import type { CandlestickData, UTCTimestamp } from "lightweight-charts";

const DAY = 24 * 60 * 60;
const START = Date.UTC(2024, 0, 1) / 1000;

// ponytail: mulberry32, a tiny seeded PRNG so every page load draws the same charts.
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const day = (i: number) => (START + i * DAY) as UTCTimestamp;

export function candleData(count = 200, seed = 2): CandlestickData[] {
  const rand = rng(seed);
  let close = 100;
  return Array.from({ length: count }, (_, i) => {
    const open = close;
    close = Math.max(10, open + (rand() - 0.48) * 4);
    const high = Math.max(open, close) + rand() * 2;
    const low = Math.min(open, close) - rand() * 2;
    return { time: day(i), open, high, low, close };
  });
}
