import type { CandlestickData, LineData, UTCTimestamp } from "lightweight-charts";
import type { GroupedBarsData, HeatMapData, WhiskerData } from "@vecordis/lightweight-plugins";

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

export function lineData(count = 150, seed = 1): LineData[] {
  const rand = rng(seed);
  let value = 100;
  return Array.from({ length: count }, (_, i) => {
    value = Math.max(10, value + (rand() - 0.48) * 4);
    return { time: day(i), value };
  });
}

export function candleData(count = 150, seed = 2): CandlestickData[] {
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

// Ten 10-wide price bands per bar; amounts (0-100) peak around a drifting centre band.
export function heatmapData(count = 40, seed = 3): HeatMapData[] {
  const rand = rng(seed);
  let centre = 5;
  return Array.from({ length: count }, (_, i) => {
    centre = Math.min(8, Math.max(1, centre + (rand() - 0.5)));
    return {
      time: day(i),
      cells: Array.from({ length: 10 }, (_, band) => ({
        low: band * 10,
        high: band * 10 + 10,
        amount: 100 * Math.exp(-((band - centre) ** 2) / 4) * (0.7 + 0.3 * rand()),
      })),
    };
  });
}

export function whiskerData(count = 40, seed = 4): WhiskerData[] {
  const rand = rng(seed);
  let base = 50;
  return Array.from({ length: count }, (_, i): WhiskerData => {
    base += (rand() - 0.5) * 6;
    const q = Array.from({ length: 5 }, () => base + (rand() - 0.5) * 30).sort((a, b) => a - b);
    const outliers = rand() < 0.2 ? [q[0] - 5 - rand() * 5, q[4] + 5 + rand() * 5] : undefined;
    return { time: day(i), quartiles: [q[0], q[1], q[2], q[3], q[4]], outliers };
  });
}

export function groupedBarsData(count = 40, groups = 3, seed = 5): GroupedBarsData[] {
  const rand = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    time: day(i),
    values: Array.from({ length: groups }, () => 20 + rand() * 80),
  }));
}
