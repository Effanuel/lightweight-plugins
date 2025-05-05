import type { CandlestickData, Time } from "lightweight-charts";

export async function fetchCandlesFromMexc(
  symbol: string = "BTC_USDT",
  interval: string = "Min5",
  limit: number = 200
): Promise<CandlestickData<Time>[]> {
  try {
    const response = await fetch(`/api/mexc/candles?symbol=${symbol}&interval=${interval}&limit=${limit}`);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid API response format");
    }

    return data;
  } catch (error) {
    console.error("Error fetching candles from server:", error);
    throw error;
  }
}

export interface SymbolInfo {
  symbol: string;
}

export async function fetchSymbolsFromMexc(): Promise<SymbolInfo[]> {
  try {
    const response = await fetch("/api/mexc/symbols");

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid API response format");
    }

    return data;
  } catch (error) {
    console.error("Error fetching symbols from server:", error);
    throw error;
  }
}
