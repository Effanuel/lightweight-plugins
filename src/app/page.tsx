"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import useMexcData, { IntervalValue } from "@/hooks/useMexcData";
import useSymbols from "@/hooks/useSymbols";
import LoadingIndicator from "@/components/LoadingIndicator/LoadingIndicator";
import { CandlestickData, Time } from "lightweight-charts";
import { CustomSelect, SelectOption } from "@/components/ui/custom-select";
import { Button } from "@/components/ui/button";

// Use dynamic import for the Chart component to avoid SSR issues
const Chart = dynamic(() => import("@/components/Chart/Chart"), {
  loading: () => <LoadingIndicator message="Initializing chart..." />,
  ssr: false, // Disable SSR for the chart to prevent hydration issues
});

const intervals: SelectOption<IntervalValue>[] = [
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
  const [interval, setInterval] = useState<IntervalValue>("Min5");

  const { symbols, isLoading: isLoadingSymbols } = useSymbols();
  const { candles, isLoading, error, refetch } = useMexcData({ symbol, interval });

  const currentPrice =
    candles.length > 0 ? (candles[candles.length - 1] as CandlestickData<Time>).close.toFixed(2) : "Loading...";

  useEffect(() => {
    document.title = `${currentPrice} | ${symbol}`;
  }, [currentPrice, symbol]);

  const symbolOptions: SelectOption<string>[] = symbols.map((symbol) => ({
    label: symbol.symbol,
    value: symbol.symbol,
  }));

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-tw-blue p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CustomSelect
            options={symbolOptions}
            value={symbol}
            onValueChange={setSymbol}
            placeholder="Select symbol"
            isLoading={isLoadingSymbols}
            loadingPlaceholder="Loading symbols..."
            disabled={isLoadingSymbols}
            virtualized={false}
            maxHeight={300}
            itemHeight={40}
          />

          <CustomSelect
            options={intervals}
            value={interval}
            onValueChange={setInterval}
            placeholder="Select interval"
            virtualized={false}
          />

          <Button onClick={() => refetch()} variant="outline" disabled={isLoading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-lg bg-tw-blue-100">
        {isLoading && candles.length === 0 ? (
          <LoadingIndicator />
        ) : error ? (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <p className="text-red-500">Error loading data: {error.message}</p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </div>
        ) : (
          <Chart candles={candles} symbol={symbol} isLoading={isLoading} />
        )}
      </div>
    </main>
  );
}
