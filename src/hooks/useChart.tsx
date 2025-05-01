"use client";

import React from "react";
import type { Candle } from "@/types/candle";
import {
  type CandlestickSeriesPartialOptions,
  type IChartApi,
  type ISeriesApi,
  createChart as lightWeightCreateChart,
  LineData,
} from "lightweight-charts";

const ChartContext = React.createContext<ReturnType<typeof useChart> | null>(null);

export function ChartProvider({ children }: { children: React.ReactNode }) {
  const chart = useChart();
  return <ChartContext.Provider value={chart}>{children}</ChartContext.Provider>;
}

export function useChartContext() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChartContext must be used within a ChartProvider");
  }
  return context;
}

export default function useChart() {
  const chart = React.useRef<IChartApi | null>(null);
  const series = React.useRef<ISeriesApi<"Candlestick" | "Line"> | null>(null);
  const secondSeries = React.useRef<ISeriesApi<"Candlestick" | "Line"> | null>(null);

  const createChart: typeof lightWeightCreateChart = (container, options) => {
    if (chart.current && window.document.getElementsByClassName("tv-lightweight-charts").length) {
      console.warn("Chart instance already exists");
      return chart.current;
    }
    return (chart.current = lightWeightCreateChart(container, options));
  };

  const createCandlesticks = (data: Candle[], options?: CandlestickSeriesPartialOptions): ISeriesApi<"Candlestick"> => {
    if (!chart.current) {
      return console.warn("Failed to init candlesticks. Chart is undefined") as any;
    }

    const candlestickSeries = chart.current.addCandlestickSeries(options);
    candlestickSeries.setData(data);
    return (series.current = candlestickSeries);
  };

  const createLineSeries = (data: LineData[], options?: CandlestickSeriesPartialOptions): ISeriesApi<"Line"> => {
    if (!chart.current) {
      return console.warn("Failed to init line chart. Chart is undefined") as any;
    }

    const lineSeries = chart.current.addLineSeries({ ...options, color: "#ef4444" });
    lineSeries.setData(data);

    const secondLineSeries = chart.current.addLineSeries({ ...options, color: "#22c55e" });
    secondSeries.current = secondLineSeries;
    secondLineSeries.setData(data);

    return (series.current = lineSeries);
  };

  const updateLine1 = (data: (oldData: readonly LineData[]) => LineData[]) => {
    if (!series.current) {
      return console.warn("Failed to update line chart. Series is undefined") as any;
    }

    series.current.setData(data(series.current.data() as LineData[]));
  };

  const updateLine2 = (data: (oldData: readonly LineData[]) => LineData[]) => {
    if (!secondSeries.current) {
      return console.warn("Failed to update line chart. Series is undefined") as any;
    }

    secondSeries.current?.setData(data(secondSeries.current.data() as LineData[]));
  };

  return { chart, createChart, createCandlesticks, createLineSeries, updateLine1, updateLine2 };
}
