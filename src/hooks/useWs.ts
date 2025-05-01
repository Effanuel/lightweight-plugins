import { useEffect, useRef, useState } from "react";

export default function useWs({
  symbol,
  url,
  onMessage,
}: {
  symbol: string;
  url: string;
  onMessage: (event: MessageEvent) => void;
}) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lowerCaseSymbol = symbol.toLowerCase();
    const streamName = `${lowerCaseSymbol}@trade`;
    const fullUrl = `${url}/${streamName}`;

    console.log(`Connecting to ${fullUrl}...`);
    setError(null);

    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      console.log("Closing previous WebSocket connection...");
      ws.current.close();
    }

    ws.current = new WebSocket(fullUrl);

    ws.current.onopen = () => {
      console.log(`WebSocket connected to ${streamName}`);
      setIsConnected(true);
      setError(null);
    };

    ws.current.onmessage = onMessage;

    ws.current.onerror = (event) => {
      console.error("WebSocket error:", event);
      setError("WebSocket connection error. Check console.");
      setIsConnected(false);
    };

    ws.current.onclose = (event) => {
      console.log(`WebSocket disconnected from ${streamName}. Code: ${event.code}, Reason: ${event.reason}`);
      if (ws.current && ws.current.readyState === WebSocket.CLOSED) {
        setIsConnected(false);
        // Optional: Implement automatic reconnection logic here if needed
      }
    };

    return () => {
      if (ws.current) {
        console.log(`Closing WebSocket connection for ${streamName}...`);
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
      setIsConnected(false);
    };
  }, []);

  return {
    isConnected,
    error,
  };
}
