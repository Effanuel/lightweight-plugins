import { useState, useEffect } from "react";
import { fetchSymbolsFromMexc, SymbolInfo } from "@/services/mexcApi";

export default function useSymbols() {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSymbols = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const fetchedSymbols = await fetchSymbolsFromMexc();
      setSymbols(fetchedSymbols);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch symbols:", err);
      setError(err instanceof Error ? err : new Error("An unknown error occurred"));

      // Fallback to major symbols if API fails
      if (symbols.length === 0) {
        setSymbols([{ symbol: "BTC_USDT" }, { symbol: "ETH_USDT" }, { symbol: "SOL_USDT" }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch symbols on mount
  useEffect(() => {
    fetchSymbols();
  }, []);

  return {
    symbols,
    isLoading,
    error,
    lastUpdated,
    refetch: fetchSymbols,
  };
}
