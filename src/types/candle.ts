import type { CandlestickData, Time, WhitespaceData } from "lightweight-charts";

export type Candle = CandlestickData<Time> | WhitespaceData<Time>;
