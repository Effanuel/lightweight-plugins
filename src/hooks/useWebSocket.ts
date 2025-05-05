import { useEffect } from "react";
import { useWebSocketContext } from "@/context/WebSocketContext";

/**
 * @deprecated Use useWebSocketContext() directly instead
 */
export default function useWebSocket(symbol: string) {
  const context = useWebSocketContext();

  // Connect to the symbol on mount or when symbol changes
  useEffect(() => {
    context.connectToSymbol(symbol);
  }, [symbol, context]);

  return {
    lastTrade: context.lastTrade,
    isConnected: context.isConnected,
    subscribeStatus: context.subscribeStatus,
    error: context.error,
  };
}
