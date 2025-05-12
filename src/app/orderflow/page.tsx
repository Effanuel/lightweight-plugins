"use client";

import { IChartApi, WhitespaceData, createChart } from "lightweight-charts";
import { CandleData, generateAlternativeCandleData, generateLineData } from "./sample-data";
import { RoundedCandleSeries } from "./rounded-candles-series";
import React from "react";
import { ChartOptions } from "@/components/Chart/chart-options";

export default function OrderflowPage() {
  const chartDiv = React.useRef<IChartApi | null>(null);

  React.useEffect(() => {
    if (!chartDiv.current) {
      throw new Error("Chart div element doesnt exist");
    }

    const chart = ((window as unknown as any).chart = createChart(chartDiv.current!, {
      ...ChartOptions,
      height: 1000,
      width: 1000,
    }));

    chartDiv.current = chart;

    // chart.addLineSeries().setData(generateLineData());

    const customSeriesView = new RoundedCandleSeries();
    const myCustomSeries = chart.addCustomSeries(customSeriesView, {
      color: "#FF00FF", // TESTING: shouldn't see this because we are coloring each bar later
    });

    const { upColor, downColor } = myCustomSeries.options();

    let lastValue = -Infinity;
    const data: (CandleData | WhitespaceData)[] = generateAlternativeCandleData().map((d) => {
      // we add the item colors here instead of providing an
      // API to do it internally.
      const color = d.close >= lastValue ? upColor : downColor;
      lastValue = d.close;
      return { ...d, color };
    });
    data[data.length - 2] = { time: data[data.length - 2].time }; // test whitespace data
    myCustomSeries.setData(data);

    return () => {
      chart.remove();
    };
  }, []);

  return (
    <div className="flex flex-col space-x-4 p-4 dark">
      <div className="flex bg-tw-blue">
        <div className="flex flex-col border border-gray-500">
          <div id="chart" ref={chartDiv} className="relative z-0 flex flex-1" />
        </div>
      </div>
    </div>
  );
}
