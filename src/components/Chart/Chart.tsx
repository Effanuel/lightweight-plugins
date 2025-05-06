"use client";

import React, { useEffect, useState } from "react";
import { ChartOptions } from "./chart-options";
import usePositionPlugin, { ToolbarId } from "@/hooks/usePositionPlugin";
import { CandlestickData, Time } from "lightweight-charts";
import { useWebSocketContext } from "@/context/WebSocketContext";
import { useChartContext } from "@/context/ChartContext";
import { LoadingOverlayWrapper } from "../LoadingOverlayWrapper";

interface Props {
  candles: CandlestickData<Time>[];
  symbol?: string;
  isLoading: boolean;
}

export default function Chart(props: Props) {
  const positionPlugin = usePositionPlugin();
  const chartDiv = React.useRef<HTMLDivElement>(null);
  const [realtimePrice, setRealtimePrice] = useState<number | null>(null);
  const [priceDirection, setPriceDirection] = useState<"up" | "down" | null>(null);

  const { chartInstance, seriesInstance, createChart, createCandlesticks, updateCandle, setData, fitContent } =
    useChartContext();

  const { lastTrade, isConnected, subscribeStatus, connectToSymbol } = useWebSocketContext();

  useEffect(() => {
    connectToSymbol(props.symbol || "BTC_USDT");
  }, [props.symbol, connectToSymbol]);

  useEffect(() => {
    console.log(props.candles.at(-1)?.close, lastTrade?.price, lastTrade?.symbol, props.symbol);
    if (lastTrade && lastTrade.symbol === props.symbol && subscribeStatus === "subscribed") {
      if (realtimePrice !== null) {
        setPriceDirection(lastTrade.price > realtimePrice ? "up" : "down");
      }

      setRealtimePrice(lastTrade.price);

      const seriesData = seriesInstance.current?.data();
      const lastCandle = seriesData?.at(-1) as CandlestickData<Time>;

      if (lastCandle) {
        const timeframeInSeconds = Number(lastCandle.time) - Number(seriesData?.at(-2)?.time);

        const isNewCandle = lastTrade.timestamp - Number(lastCandle.time) > timeframeInSeconds;

        if (isNewCandle) {
          updateCandle({
            open: lastCandle.close,
            low: lastTrade.price,
            high: lastTrade.price,
            close: lastTrade.price,
            time: ((lastCandle.time as number) + timeframeInSeconds) as Time,
          });
        } else {
          updateCandle({
            open: lastCandle.open,
            time: lastCandle.time,
            low: Math.min(lastCandle.low, lastTrade.price),
            high: Math.max(lastCandle.high, lastTrade.price),
            close: lastTrade.price,
          });
        }
      }
    }
  }, [lastTrade, props.symbol, subscribeStatus]);

  useEffect(() => {
    setData(props.candles);
    setTimeout(() => fitContent(), 0);
  }, [props.candles, setData, fitContent]);

  useEffect(() => {
    if (!chartDiv.current) {
      return;
    }

    createChart(chartDiv.current, ChartOptions);
    createCandlesticks(props.candles);

    if (chartInstance.current && seriesInstance.current) {
      positionPlugin.create(chartInstance.current, seriesInstance.current);
    }

    return () => {
      positionPlugin.remove();
      chartInstance.current?.remove();
    };
  }, []);

  if (!props.candles || props.candles.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-tw-blue">
        <div title="Position tool" id={ToolbarId} className="bg-[#141722] h-7 flex justify-center" />
        <div className="flex flex-1 flex-col items-center justify-center border border-gray-500">
          <p className="text-gray-400">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <LoadingOverlayWrapper isLoading={props.isLoading} message="Updating chart data...">
      <div className="flex flex-col h-full w-full bg-tw-blue">
        <div title="Position tool" id={ToolbarId} className="bg-[#141722] h-7 flex justify-center gap-x-4">
          <div className="flex items-center">
            {isConnected ? (
              <>
                <span className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                <span className="text-xs text-gray-300">Live</span>
                {realtimePrice && (
                  <span
                    className={`ml-2 text-xs font-medium ${
                      priceDirection === "up"
                        ? "text-green-400"
                        : priceDirection === "down"
                        ? "text-red-400"
                        : "text-white"
                    }`}
                  >
                    ${realtimePrice.toFixed(2)}
                  </span>
                )}
              </>
            ) : (
              "Not connected"
            )}
            {subscribeStatus === "subscribing" && <span className="text-xs text-gray-300">Subscribing...</span>}
          </div>
        </div>
        <div className="flex flex-1 flex-col border border-gray-500">
          <div id="chart" ref={chartDiv} className="relative z-0 flex w-full flex-1" />
        </div>
      </div>
    </LoadingOverlayWrapper>
  );
}
