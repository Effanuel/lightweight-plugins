"use client";

import React, { createContext, useContext, useRef, ReactNode } from "react";
import {
  createChart as lightWeightCreateChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type CandlestickSeriesPartialOptions,
  type Time,
} from "lightweight-charts";

interface ChartContextType {
  chartInstance: React.MutableRefObject<IChartApi | null>;
  seriesInstance: React.MutableRefObject<ISeriesApi<"Candlestick"> | null>;
  createChart: typeof lightWeightCreateChart;
  createCandlesticks: (
    data: CandlestickData<Time>[],
    options?: CandlestickSeriesPartialOptions
  ) => ISeriesApi<"Candlestick">;
  updateCandle: (data: CandlestickData<Time>) => void;
  setData: (data: CandlestickData<Time>[]) => void;
  fitContent: () => void;
}

const ChartContext = createContext<ChartContextType | null>(null);

export function useChartContext() {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error("useChartContext must be used within a ChartProvider");
  }
  return context;
}

export const ChartProvider = ({ children }: { children: ReactNode }) => {
  const chartInstance = useRef<IChartApi | null>(null);
  const seriesInstance = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const createChart: typeof lightWeightCreateChart = (container, options) => {
    // Check if chart already exists in the container
    const chartDiv = window.document.getElementById((container as HTMLDivElement).id);
    if (!chartDiv) {
      throw new Error("Chart div element doesn't exist");
    }

    if (chartInstance.current && chartDiv.getElementsByClassName("tv-lightweight-charts").length) {
      console.warn("Chart instance already exists");
      return chartInstance.current;
    }

    return (chartInstance.current = lightWeightCreateChart(container, options));
  };

  const createCandlesticks = (
    data: CandlestickData<Time>[],
    options?: CandlestickSeriesPartialOptions
  ): ISeriesApi<"Candlestick"> => {
    if (!chartInstance.current) {
      throw new Error("Failed to initialize candlesticks. Chart is undefined");
    }

    const candlestickSeries = chartInstance.current.addCandlestickSeries(options);
    candlestickSeries.setData(data);
    return (seriesInstance.current = candlestickSeries);
  };

  const updateCandle = (data: CandlestickData<Time>) => {
    seriesInstance.current?.update(data);
  };

  const setData = (data: CandlestickData<Time>[]) => {
    seriesInstance.current?.setData(data);
  };

  const fitContent = () => {
    chartInstance.current?.timeScale().fitContent();
  };

  const contextValue: ChartContextType = {
    chartInstance,
    seriesInstance,
    createChart,
    createCandlesticks,
    updateCandle,
    setData,
    fitContent,
  };

  return <ChartContext.Provider value={contextValue}>{children}</ChartContext.Provider>;
};
