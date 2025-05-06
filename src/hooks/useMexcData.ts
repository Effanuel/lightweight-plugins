import useSWR from "swr";
import { fetchCandlesFromMexc } from "@/services/mexcApi";
import { CandlestickData, Time } from "lightweight-charts";

export type IntervalValue = "Min1" | "Min5" | "Min15" | "Min30" | "Min60" | "Hour4" | "Day1";

interface UseMexcDataProps {
  symbol?: string;
  interval?: IntervalValue;
  limit?: number;
}

export default function useMexcData({ symbol = "BTC_USDT", interval = "Min5", limit = 200 }: UseMexcDataProps = {}) {
  const fetchKey = `/api/mexc/candles?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const fetcher = async () => {
    return await fetchCandlesFromMexc(symbol, interval, limit);
  };

  const {
    data: candles = [],
    error,
    isLoading,
    mutate: refetch,
  } = useSWR<CandlestickData<Time>[]>(fetchKey, fetcher, {
    revalidateOnFocus: false,
    errorRetryCount: 3,
    keepPreviousData: true,
    onError: (err) => {
      console.error("Error in useMexcData:", err);
    },
  });

  return {
    candles,
    isLoading,
    error,
    refetch,
  };
}
