"use client";

import React, { useEffect, useState } from "react";
import useChart from "@/hooks/useChart";
import { ChartOptions } from "./chart-options";
import usePositionPlugin, { ToolbarId } from "@/hooks/usePositionPlugin";
import { PriceLinesManager } from "@/plugins/price-line";
import { CandlestickData, IChartApi, ISeriesApi, LineStyle, Time } from "lightweight-charts";
import { useWebSocketContext } from "@/context/WebSocketContext";

const priceLinesManager = new PriceLinesManager();

interface Props {
  candles: CandlestickData<Time>[];
  symbol?: string;
  timeframe?: string;
}

export default function Chart(props: Props) {
  const { createChart, createCandlesticks } = useChart();
  const positionPlugin = usePositionPlugin();
  const chartDiv = React.useRef<HTMLDivElement>(null);
  const chartInstance = React.useRef<IChartApi>(null);
  const seriesInstance = React.useRef<ISeriesApi<"Candlestick">>(null);
  const [realtimePrice, setRealtimePrice] = useState<number | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [priceDirection, setPriceDirection] = useState<"up" | "down" | null>(null);

  const { lastTrade, isConnected, subscribeStatus, connectToSymbol } = useWebSocketContext();

  useEffect(() => {
    connectToSymbol(props.symbol || "BTC_USDT");
  }, [props.symbol, connectToSymbol]);

  useEffect(() => {
    if (lastTrade && lastTrade.symbol === props.symbol && subscribeStatus === "subscribed") {
      if (realtimePrice !== null) {
        setPriceDirection(lastTrade.price > realtimePrice ? "up" : "down");
      }

      setRealtimePrice(lastTrade.price);
      setLastUpdateTime(new Date(lastTrade.timestamp));

      const seriesData = seriesInstance.current?.data();
      const lastCandle = seriesData?.at(-1) as CandlestickData<Time>;

      if (lastCandle) {
        const timeframeInSeconds = props.timeframe === "1m" ? 60 : props.timeframe === "5m" ? 300 : 3600;

        const isNewCandle = lastTrade.timestamp - Number(lastCandle.time) > timeframeInSeconds;

        if (isNewCandle) {
          seriesInstance.current?.update({
            open: lastCandle.close,
            low: lastTrade.price,
            high: lastTrade.price,
            close: lastTrade.price,
            time: ((lastCandle.time as number) + timeframeInSeconds) as Time,
          });
        } else {
          seriesInstance.current?.update({
            open: lastCandle.open,
            time: lastCandle.time,
            low: Math.min(lastCandle.low, lastTrade.price),
            high: Math.max(lastCandle.high, lastTrade.price),
            close: lastTrade.price,
          });
        }
      }
    }
  }, [lastTrade, props.symbol, subscribeStatus, props.timeframe]);

  const watermark = {
    visible: true,
    text: props.symbol + " " + (props.timeframe ?? ""),
    color: "rgba(255, 255, 255, 0.1)",
    fontSize: 75,
    horzAlign: "center",
    vertAlign: "center",
  } as const;

  useEffect(() => {
    if (props.symbol) chartInstance.current?.applyOptions({ watermark });
  }, [props.symbol]);

  useEffect(() => {
    seriesInstance.current?.setData(props.candles);
    setTimeout(() => chartInstance.current?.timeScale().fitContent(), 0);
  }, [props.candles]);

  useEffect(() => {
    if (!chartDiv.current) {
      return;
    }

    if (!chartInstance.current) {
      chartInstance.current = createChart(chartDiv.current, ChartOptions);

      if (props.symbol) {
        chartInstance.current.applyOptions({ watermark });
      }
    }

    seriesInstance.current = createCandlesticks(props.candles);
    positionPlugin.create(chartInstance.current, seriesInstance.current);

    priceLinesManager.init(chartInstance.current, seriesInstance.current);

    // Add initial price line using the last candle
    const lastCandle = props.candles[props.candles.length - 1];
    const lastPrice = lastCandle.close;

    priceLinesManager.addPriceLine("line1", {
      price: lastPrice,
      color: "blue",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: "Current",
    });

    return () => {
      if (chartInstance.current) {
        positionPlugin.remove();
        priceLinesManager.reset();
        chartInstance.current.remove();
        chartInstance.current = null;
        seriesInstance.current = null;
      }
    };
  }, []);

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

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
                  {lastUpdateTime && <span className="ml-2 text-gray-400 text-xs">({formatTime(lastUpdateTime)})</span>}
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
  );
}
