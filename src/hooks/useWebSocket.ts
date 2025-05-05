import { useState, useEffect, useRef } from "react";

interface TradeData {
  symbol: string;
  price: number;
  timestamp: number;
}

export default function useWebSocket(symbol: string) {
  const [lastTrade, setLastTrade] = useState<TradeData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Initialize WebSocket worker
  useEffect(() => {
    if (typeof window === "undefined") return; // Skip during SSR

    // Safely create worker with dynamic import
    const createWorker = async () => {
      try {
        const worker = new Worker(new URL("../workers/mexcWebsocket.worker.ts", import.meta.url), {
          type: "module",
        });

        workerRef.current = worker;

        worker.addEventListener("message", (event) => {
          const { type, data } = event.data;

          switch (type) {
            case "trade":
              setLastTrade(data);
              break;
            case "connected":
              setIsConnected(true);
              break;
            case "disconnected":
              setIsConnected(false);
              break;
            case "error":
              setError(new Error(data.message));
              break;
          }
        });

        worker.postMessage({ type: "connect", symbol });
      } catch (err) {
        console.error("Failed to create WebSocket worker:", err);
        setError(err instanceof Error ? err : new Error("Failed to initialize WebSocket worker"));
      }
    };

    createWorker();

    // Cleanup on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: "disconnect" });

        // Give the worker a moment to clean up before terminating
        setTimeout(() => {
          workerRef.current?.terminate();
          workerRef.current = null;
        }, 100);

        setIsConnected(false);
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // Update symbol when it changes
  useEffect(() => {
    if (workerRef.current && symbol) {
      workerRef.current.postMessage({ type: "changeSymbol", symbol });
    }
  }, [symbol]);

  return {
    lastTrade,
    isConnected,
    error,
  };
}
