"use client";

import React, { useState, useCallback } from "react";
import numeral from "numeral";
import TradeLineChart from "@/components/TradeLineChart/TradeLineChart";
import { useCvdChartContext } from "@/hooks/useCvdCharts";
import { Time } from "lightweight-charts";
import useWs from "@/hooks/useWs";
import { roundTime } from "@/utils";
import CvdLineChart from "@/components/CvdLineChart/CvdLineChart";

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

export default function CvdPage() {
  const [cvd, setCvd] = useState<number>(0);
  const [price, setPrice] = useState<string>("0");
  const { updateLine1, updateLine2, updateCvd } = useCvdChartContext();

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: BinanceTradeMessage = JSON.parse(event.data);

      if (message.e === "trade" && message.s === "BTCUSDT") {
        const tradeVolume = parseFloat(message.q);
        const tradePrice = parseFloat(message.p);

        // Calculate Volume Delta for this trade
        // If 'm' is true, buyer is maker (passive), seller is taker (aggressive) -> Negative Delta
        // If 'm' is false, seller is maker (passive), buyer is taker (aggressive) -> Positive Delta

        if (message.m) {
          updateLine1((data) => {
            const volume = tradeVolume * tradePrice;
            const currentData = [...data];
            const roundedTime = roundTime(message.T, 5) as Time;
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
            const roundedTime = roundTime(message.T, 5) as Time;
            const prevCvd = currentData.length > 0 ? currentData[currentData.length - 1].value : 0;
            if (roundedTime === (currentData[currentData.length - 1]?.time as Time)) {
              currentData[currentData.length - 1].value = prevCvd + volume;
              return currentData;
            }
            return [...currentData, { time: roundedTime, value: prevCvd + volume }];
          });
        }

        const volumeDelta = message.m ? -tradeVolume * tradePrice : tradeVolume * tradePrice;
        updateCvd((data) => {
          const currentData = [...data];
          const roundedTime = roundTime(message.T, 5) as Time;
          const prevCvd = currentData.length > 0 ? currentData[currentData.length - 1].value : 0;
          if (roundedTime === (currentData[currentData.length - 1]?.time as Time)) {
            currentData[currentData.length - 1].value = prevCvd + volumeDelta;
            return currentData;
          }
          return [...currentData, { time: roundedTime, value: prevCvd + volumeDelta }];
        });

        setCvd((prevCvd) => prevCvd + volumeDelta);
        setPrice(message.p);
      }
    } catch (err) {
      console.error("Failed to parse message or calculate CVD:", err);
      // Optionally set an error state here
    }
  }, []); // Recalculate handler if symbol changes

  const { isConnected, error } = useWs({
    symbol: "BTCUSDT",
    url: "wss://fstream.binance.com/ws",
    onMessage: handleMessage,
  });

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

      {isConnected ? (
        <div className="p-4">
          <h2 className="text-xl">BTCUSDT</h2>
          <p>Price: {parseFloat(price).toFixed(2)}</p>
          <p className="cvd-value">
            CVD: <span className={cvd > 0 ? "text-green-500" : "text-red-500"}>{numeral(cvd).format("0.[0]a")}</span>
          </p>
        </div>
      ) : (
        <p>Attempting to connect...</p>
      )}
      <TradeLineChart />
      <CvdLineChart />
    </div>
  );
}
