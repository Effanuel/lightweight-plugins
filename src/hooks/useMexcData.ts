import { useState, useEffect } from "react";
import { fetchCandlesFromMexc } from "@/services/mexcApi";
import { CandlestickData, Time } from "lightweight-charts";

interface UseMexcDataProps {
  symbol?: string;
  interval?: string;
  limit?: number;
}

export default function useMexcData({ symbol = "BTC_USDT", interval = "Min5", limit = 200 }: UseMexcDataProps = {}) {
  const [candles, setCandles] = useState<CandlestickData<Time>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const data = await fetchCandlesFromMexc(symbol, interval, limit);
      setCandles(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("An unknown error occurred"));
      console.error("Error in useMexcData:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial data fetch
    fetchData();
  }, [symbol, interval, limit]); // Re-fetch data if these props change

  return {
    candles,
    isLoading,
    error,
    refetch: fetchData,
  };
}
