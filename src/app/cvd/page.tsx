"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import numeral from "numeral";
import LineChart from "@/components/LineChart/LineChart";
import { useChartContext } from "@/hooks/useChart";
import { Time } from "lightweight-charts";

const roundTime = (time: number) => {
  const timeInSeconds = Math.floor(time / 1000);
  const secondsDiff = timeInSeconds % 5;
  return timeInSeconds - secondsDiff;
};

interface BinanceTradeMessage {
  e: string; // Event type (e.g., "trade")
  E: number; // Event time
  s: string; // Symbol
  t: number; // Trade ID
  p: string; // Price
  q: string; // Quantity
  b: number; // Buyer order ID
  a: number; // Seller order ID
  T: number; // Trade time
  m: boolean; // Is the buyer the maker?
  M: boolean; // Ignore
}

const WEBSOCKET_URL = "wss://fstream.binance.com/ws";
const DEFAULT_SYMBOL = "BTCUSDT"; // Default symbol

export default function CvdPage() {
  const [cvd, setCvd] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<string>("0");
  const { updateLine1, updateLine2 } = useChartContext();

  const ws = useRef<WebSocket | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: BinanceTradeMessage = JSON.parse(event.data);

      // Ensure it's a trade message for the correct symbol (though stream is specific)
      if (message.e === "trade" && message.s === DEFAULT_SYMBOL) {
        const tradeVolume = parseFloat(message.q);
        const tradePrice = parseFloat(message.p);

        // Calculate Volume Delta for this trade
        // If 'm' is true, buyer is maker (passive), seller is taker (aggressive) -> Negative Delta
        // If 'm' is false, seller is maker (passive), buyer is taker (aggressive) -> Positive Delta

        if (message.m) {
          updateLine1((data) => {
            const volume = tradeVolume * tradePrice;
            const currentData = [...data];
            const roundedTime = roundTime(message.T) as Time;
            const prevCvd = currentData.length > 0 ? currentData[currentData.length - 1].value : 0;
            if (roundedTime === (currentData[currentData.length - 1]?.time as Time)) {
              currentData[currentData.length - 1].value = prevCvd + volume;
              return currentData;
            }
            return [...currentData, { time: roundedTime, value: prevCvd + volume }];
          });
        } else {
          updateLine2((data) => {
            const volume = tradeVolume * tradePrice;
            const currentData = [...data];
            const roundedTime = roundTime(message.T) as Time;
            const prevCvd = currentData.length > 0 ? currentData[currentData.length - 1].value : 0;
            if (roundedTime === (currentData[currentData.length - 1]?.time as Time)) {
              currentData[currentData.length - 1].value = prevCvd + volume;
              return currentData;
            }
            return [...currentData, { time: roundedTime, value: prevCvd + volume }];
          });
        }

        // updateBaseline((data) => {
        //   const currentData = [...data];
        //   const roundedTime = roundTime(message.T);
        //   const prevCvd = currentData.length > 0 ? currentData[currentData.length - 1].value : 0;
        //   if (roundedTime === (currentData[currentData.length - 1]?.time as number)) {
        //     currentData[currentData.length - 1].value = prevCvd + volumeDelta;
        //     return currentData;
        //   }
        //   return [...currentData, { time: roundedTime, value: prevCvd + volumeDelta }];
        // });
        const volumeDelta = message.m ? -tradeVolume * tradePrice : tradeVolume * tradePrice;
        setCvd((prevCvd) => prevCvd + volumeDelta);
        setLastPrice(message.p); // Update last price display
      }
    } catch (err) {
      console.error("Failed to parse message or calculate CVD:", err);
      // Optionally set an error state here
    }
  }, []); // Recalculate handler if symbol changes

  // useEffect for WebSocket connection management
  useEffect(() => {
    const lowerCaseSymbol = DEFAULT_SYMBOL.toLowerCase();
    const streamName = `${lowerCaseSymbol}@trade`;
    const fullUrl = `${WEBSOCKET_URL}/${streamName}`;

    console.log(`Connecting to ${fullUrl}...`);
    setError(null); // Clear previous errors
    setCvd(0); // Reset CVD when symbol changes
    setLastPrice("0"); // Reset last price

    // Close existing connection if any before opening a new one
    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      console.log("Closing previous WebSocket connection...");
      ws.current.close();
    }

    // Create new WebSocket instance
    ws.current = new WebSocket(fullUrl);

    ws.current.onopen = () => {
      console.log(`WebSocket connected to ${streamName}`);
      setIsConnected(true);
      setError(null);
    };

    ws.current.onmessage = handleMessage; // Use the memoized handler

    ws.current.onerror = (event) => {
      console.error("WebSocket error:", event);
      setError("WebSocket connection error. Check console.");
      setIsConnected(false);
    };

    ws.current.onclose = (event) => {
      console.log(`WebSocket disconnected from ${streamName}. Code: ${event.code}, Reason: ${event.reason}`);
      // Only set disconnected if it wasn't a deliberate close initiated by changing the symbol/unmounting
      // Check readyState before setting state
      if (ws.current && ws.current.readyState === WebSocket.CLOSED) {
        setIsConnected(false);
        // Optional: Implement automatic reconnection logic here if needed
      }
    };

    // Cleanup function: Close WebSocket connection when component unmounts or symbol changes
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
  }, [handleMessage]);

  return (
    <div className="flex flex-col space-x-4 p-4 dark">
      <h1>Binance Cumulative Volume Delta (CVD)</h1>

      <div>
        <p>
          Status:{" "}
          <span className={isConnected ? "text-green-500" : "text-red-500"}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </p>
        {error && <p className="error">Error: {error}</p>}
      </div>

      {isConnected && (
        <div className="p-4">
          <h2 className="text-xl">{DEFAULT_SYMBOL}</h2>
          <p>Last Price: {parseFloat(lastPrice).toFixed(2)}</p>
          <p className="cvd-value">
            CVD: <span className={cvd > 0 ? "text-green-500" : "text-red-500"}>{numeral(cvd).format("0.[0]a")}</span>
          </p>
        </div>
      )}
      {!isConnected && <p>Attempting to connect...</p>}

      <LineChart />
    </div>
  );
}
