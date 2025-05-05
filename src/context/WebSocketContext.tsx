"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

interface TradeData {
  symbol: string;
  price: number;
  timestamp: number;
}

type SubscribeStatus = "subscribed" | "subscribing" | "not-subscribed";

interface WebSocketContextType {
  lastTrade: TradeData | null;
  isConnected: boolean;
  subscribeStatus: SubscribeStatus;
  error: Error | null;
  connectToSymbol: (symbol: string) => void;
  disconnectWebSocket: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider");
  }
  return context;
};

export const WebSocketProvider = ({
  children,
  initialSymbol = "BTC_USDT",
}: {
  children: ReactNode;
  initialSymbol?: string;
}) => {
  const [lastTrade, setLastTrade] = useState<TradeData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [subscribeStatus, setSubscribeStatus] = useState<SubscribeStatus>("not-subscribed");
  const [error, setError] = useState<Error | null>(null);
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const workerRef = useRef<Worker | null>(null);
  const isFirstRender = useRef(true);

  // Initialize WebSocket worker
  useEffect(() => {
    if (typeof window === "undefined") return; // Skip during SSR

    // Create worker on first mount
    const createWorker = async () => {
      try {
        const worker = new Worker(new URL("../workers/mexcWebsocket.worker.ts", import.meta.url), {
          type: "module",
        });

        workerRef.current = worker;

        worker.addEventListener("message", (event) => {
          const { type, data, symbol: eventSymbol } = event.data;

          switch (type) {
            case "trade":
              setLastTrade(data);
              break;
            case "connected":
              setIsConnected(true);
              break;
            case "subscribing":
              setSubscribeStatus("subscribing");
              break;
            case "subscribed":
              setSubscribeStatus("subscribed");
              break;
            case "disconnected":
              setSubscribeStatus("not-subscribed");
              setIsConnected(false);
              break;
            case "error":
              setError(new Error(data.message));
              break;
          }
        });

        // Connect to initial symbol
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
        setSubscribeStatus("not-subscribed");
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // Handle symbol changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (workerRef.current && symbol) {
      workerRef.current.postMessage({ type: "changeSymbol", symbol });
    }
  }, [symbol]);

  // Public methods exposed through context
  const connectToSymbol = (newSymbol: string) => {
    setSymbol(newSymbol);
  };

  const disconnectWebSocket = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "disconnect" });
      setIsConnected(false);
      setSubscribeStatus("not-subscribed");
    }
  };

  const contextValue: WebSocketContextType = {
    lastTrade,
    isConnected,
    subscribeStatus,
    error,
    connectToSymbol,
    disconnectWebSocket,
  };

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
};
