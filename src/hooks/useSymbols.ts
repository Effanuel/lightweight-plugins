import useSWR from "swr";
import { SymbolInfo } from "@/services/mexcApi";

const symbolsFetcher = async (): Promise<SymbolInfo[]> => {
  const response = await fetch("/api/mexc/symbols");

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Invalid API response format");
  }

  return data;
};

export default function useSymbols() {
  const {
    data: symbols = [],
    error,
    isLoading,
  } = useSWR<SymbolInfo[]>("/api/mexc/symbols", symbolsFetcher, {
    revalidateOnFocus: false,
    fallbackData: [{ symbol: "BTC_USDT" }, { symbol: "ETH_USDT" }, { symbol: "SOL_USDT" }],
    onError: (err) => {
      console.error("Failed to fetch symbols:", err);
    },
  });

  return { symbols, isLoading, error };
}
