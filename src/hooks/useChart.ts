import React from "react";
import type { Candle } from "@/types/candle";
import {
  type CandlestickSeriesPartialOptions,
  type IChartApi,
  type ISeriesApi,
  createChart as lightWeightCreateChart,
} from "lightweight-charts";

export default function useChart() {
  const chart = React.useRef<IChartApi | null>(null);
  const series = React.useRef<ISeriesApi<"Candlestick"> | null>(null);

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

  return { chart, createChart, createCandlesticks };
}
