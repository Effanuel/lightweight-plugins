"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import useMexcData from "@/hooks/useMexcData";
import useSymbols from "@/hooks/useSymbols";
import LoadingIndicator from "@/components/LoadingIndicator/LoadingIndicator";
import { CandlestickData, Time } from "lightweight-charts";

// Use dynamic import for the Chart component to avoid SSR issues
const Chart = dynamic(() => import("@/components/Chart/Chart"), {
  loading: () => <LoadingIndicator message="Initializing chart..." />,
  ssr: false, // Disable SSR for the chart to prevent hydration issues
});

const intervals = [
  { label: "1m", value: "Min1" },
  { label: "5m", value: "Min5" },
  { label: "15m", value: "Min15" },
  { label: "30m", value: "Min30" },
  { label: "1h", value: "Min60" },
  { label: "4h", value: "Hour4" },
  { label: "1d", value: "Day1" },
];

export default function Home() {
  const [symbol, setSymbol] = useState<string>("BTC_USDT");
  const [interval, setInterval] = useState<string>("Min5");

  // Use our custom hook for symbols management
  const { symbols: availableSymbols, isLoading: isLoadingSymbols } = useSymbols();

  const { candles, isLoading, error, lastUpdated, refetch } = useMexcData({ symbol, interval });

  const currentPrice =
    candles.length > 0 ? (candles[candles.length - 1] as CandlestickData<Time>).close.toFixed(2) : "Loading...";

  const timeframe = intervals.find((i) => i.value === interval)?.label;

  useEffect(() => {
    document.title = `${currentPrice} | ${symbol}`;
  }, [currentPrice, symbol]);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-tw-blue p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">Symbol:</span>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="rounded bg-tw-blue-200 px-2 py-1 text-white"
            disabled={isLoadingSymbols}
          >
            {isLoadingSymbols ? (
              <option>Loading symbols...</option>
            ) : (
              availableSymbols.map((option) => (
                <option key={option.symbol} value={option.symbol}>
                  {option.symbol}
                </option>
              ))
            )}
          </select>

          <span className="text-sm text-gray-300 ml-4">Interval:</span>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="rounded bg-tw-blue-200 px-2 py-1 text-white"
          >
            {intervals.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => refetch()}
            className="ml-2 rounded bg-tw-blue-200 px-3 py-1 text-white hover:bg-tw-blue-300 cursor-pointer"
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-lg bg-tw-blue-100">
        {isLoading && candles.length === 0 ? (
          <LoadingIndicator />
        ) : error ? (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <p className="text-red-500">Error loading data: {error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded bg-tw-blue-200 px-3 py-1 text-white hover:bg-tw-blue-300"
            >
              Try Again
            </button>
          </div>
        ) : (
          <Chart candles={candles} symbol={symbol} timeframe={timeframe} />
        )}
      </div>

      {lastUpdated && (
        <div className="mt-2 text-right text-xs text-gray-400">Last updated: {lastUpdated.toLocaleTimeString()}</div>
      )}
    </main>
  );
}
