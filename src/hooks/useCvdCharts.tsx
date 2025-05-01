"use client";

import React from "react";
import type { Candle } from "@/types/candle";
import {
  BaselineData,
  CandlestickData,
  type CandlestickSeriesPartialOptions,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  createChart as lightWeightCreateChart,
} from "lightweight-charts";

interface ChartContext {
  chart: React.MutableRefObject<IChartApi | null>;
  createTradeChart: typeof lightWeightCreateChart;
  createTradeLineSeries: (data: LineData[], options?: CandlestickSeriesPartialOptions) => ISeriesApi<"Line">;
  updateLine1: (data: (oldData: readonly LineData[]) => LineData[]) => void;
  updateLine2: (data: (oldData: readonly LineData[]) => LineData[]) => void;

  createCvdChart: typeof lightWeightCreateChart;
  createCvdLineSeries: (data: LineData[], options?: CandlestickSeriesPartialOptions) => ISeriesApi<"Baseline">;
  updateCvd: (data: (oldData: readonly LineData[]) => LineData[]) => void;

  createCvdCandleChart: typeof lightWeightCreateChart;
  createCvdCandleSeries: (
    data: CandlestickData[],
    options?: CandlestickSeriesPartialOptions
  ) => ISeriesApi<"Candlestick">;
  updateCvdCandle: (data: (oldData: readonly CandlestickData[]) => CandlestickData[]) => void;
}

const CvdChartContext = React.createContext<ChartContext | null>(null);

export function CvdChartProvider({ children }: { children: React.ReactNode }) {
  const tradeChartRef = React.useRef<IChartApi | null>(null);
  const series = React.useRef<ISeriesApi<"Candlestick" | "Line"> | null>(null);
  const secondSeries = React.useRef<ISeriesApi<"Candlestick" | "Line"> | null>(null);

  const cvdChartRef = React.useRef<IChartApi | null>(null);
  const cvdChartSeries = React.useRef<ISeriesApi<"Baseline"> | null>(null);

  const cvdCandleChartRef = React.useRef<IChartApi | null>(null);
  const cvdCandleChartSeries = React.useRef<ISeriesApi<"Candlestick"> | null>(null);

  const createTradeChart: typeof lightWeightCreateChart = (container, options) => {
    const chartDiv = window.document.getElementById((container as HTMLDivElement).id);
    if (!chartDiv) {
      throw new Error("Chart div element doesn't exist");
    }
    if (tradeChartRef.current && chartDiv.getElementsByClassName("tv-lightweight-charts").length) {
      console.warn("Chart instance already exists");
      return tradeChartRef.current;
    }
    return (tradeChartRef.current = lightWeightCreateChart(container, options));
  };

  const createCvdChart: typeof lightWeightCreateChart = (container, options) => {
    const chartDiv = window.document.getElementById((container as HTMLDivElement).id);
    if (!chartDiv) {
      throw new Error("Chart div element doesn't exist");
    }
    if (cvdChartRef.current && chartDiv.getElementsByClassName("tv-lightweight-charts").length) {
      console.warn("Chart instance already exists");
      return cvdChartRef.current;
    }
    return (cvdChartRef.current = lightWeightCreateChart(container, options));
  };

  const createCvdCandleChart: typeof lightWeightCreateChart = (container, options) => {
    const chartDiv = window.document.getElementById((container as HTMLDivElement).id);
    if (!chartDiv) {
      throw new Error("Chart div element doesn't exist");
    }
    if (cvdCandleChartRef.current && chartDiv.getElementsByClassName("tv-lightweight-charts").length) {
      console.warn("Chart instance already exists");
      return cvdCandleChartRef.current;
    }
    return (cvdCandleChartRef.current = lightWeightCreateChart(container, options));
  };

  const createTradeLineSeries = (data: LineData[], options?: CandlestickSeriesPartialOptions): ISeriesApi<"Line"> => {
    if (!tradeChartRef.current) {
      return console.warn("Failed to init line chart. Chart is undefined") as any;
    }

    const lineSeries = tradeChartRef.current.addLineSeries({ ...options, color: "#ef4444" });
    // lineSeries.setData(data);

    const secondLineSeries = tradeChartRef.current.addLineSeries({ ...options, color: "#22c55e" });
    secondSeries.current = secondLineSeries;
    // secondLineSeries.setData(data);

    return (series.current = lineSeries);
  };

  const createCvdLineSeries = (
    data: BaselineData[],
    options?: CandlestickSeriesPartialOptions
  ): ISeriesApi<"Baseline"> => {
    if (!cvdChartRef.current) {
      return console.warn("Failed to init line chart. Chart is undefined") as any;
    }

    const lineSeries = cvdChartRef.current.addBaselineSeries({ ...options, baseLineColor: "#ffffff" });
    // lineSeries.setData(data);

    return (cvdChartSeries.current = lineSeries);
  };

  const createCvdCandleSeries = (
    data: Candle[],
    options?: CandlestickSeriesPartialOptions
  ): ISeriesApi<"Candlestick"> => {
    if (!cvdCandleChartRef.current) {
      return console.warn("Failed to init candlesticks. Chart is undefined") as any;
    }

    const candlestickSeries = cvdCandleChartRef.current.addCandlestickSeries(options);
    candlestickSeries.setData(data);
    return (cvdCandleChartSeries.current = candlestickSeries);
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

  const updateCvd = (data: (oldData: readonly LineData[]) => LineData[]) => {
    if (!cvdChartSeries.current) {
      return console.warn("Failed to update line chart. Series is undefined") as any;
    }

    cvdChartSeries.current.setData(data(cvdChartSeries.current.data() as LineData[]));
  };

  const updateCvdCandle = (data: (oldData: readonly CandlestickData[]) => CandlestickData[]) => {
    if (!cvdCandleChartSeries.current) {
      return console.warn("Failed to update candlestick chart. Series is undefined") as any;
    }

    cvdCandleChartSeries.current.setData(data(cvdCandleChartSeries.current.data() as CandlestickData[]));
  };

  return (
    <CvdChartContext.Provider
      value={{
        chart: tradeChartRef,
        createTradeChart,
        createTradeLineSeries,
        updateLine1,
        updateLine2,

        createCvdChart,
        createCvdLineSeries,
        updateCvd,

        createCvdCandleChart,
        createCvdCandleSeries,
        updateCvdCandle,
      }}
    >
      {children}
    </CvdChartContext.Provider>
  );
}

export function useCvdChartContext() {
  const context = React.useContext(CvdChartContext);
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
    const chartDiv = window.document.getElementById((container as HTMLDivElement).id);
    if (!chartDiv) {
      throw new Error("Chart div element doesn't exist");
    }
    if (chart.current && chartDiv.getElementsByClassName("tv-lightweight-charts").length) {
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
    // lineSeries.setData(data);

    const secondLineSeries = chart.current.addLineSeries({ ...options, color: "#22c55e" });
    secondSeries.current = secondLineSeries;
    // secondLineSeries.setData(data);

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

  return {
    chart,
    createTradeChart: createChart,
    createCandlesticks,
    createTradeLineSeries: createLineSeries,
    updateLine1,
    updateLine2,
  };
}
