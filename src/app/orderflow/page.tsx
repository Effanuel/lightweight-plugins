"use client";

import { IChartApi, Time, WhitespaceData, createChart } from "lightweight-charts";
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
      //   radius: 3,
    });

    const date = new Date(Date.UTC(2018, 0, 1, 12, 0, 0, 0));
    // for (let i = 0; i < numberOfPoints; ++i) {

    const createFootPrintBuckets = (low: number, high: number) => {
      const bucketsMap: Record<string, { bidVolume: number; askVolume: number; delta: number }> = {};
      const bucketSize = 0.25;
      let currentLow = low;
      let currentHigh = low + bucketSize;
      while (currentHigh <= high) {
        const bidVolume = Math.round(Math.random() * 100);
        const askVolume = Math.round(Math.random() * 100);
        const delta = bidVolume - askVolume;
        bucketsMap[currentLow] = {
          bidVolume,
          askVolume,
          delta,
        };
        currentLow = currentHigh;
        currentHigh = currentLow + bucketSize;
      }
      return bucketsMap;
    };

    const buckets1 = createFootPrintBuckets(1, 10);
    const buckets2 = createFootPrintBuckets(4, 15);
    const buckets3 = createFootPrintBuckets(2, 13);
    myCustomSeries.setData([
      {
        time: (date.getTime() / 1000) as Time,
        low: 1,
        high: 10,
        open: 3,
        close: 5,
        customValues: {
          totalVolume: Object.values(buckets1).reduce((acc, curr) => acc + curr.bidVolume + curr.askVolume, 0),
          highestVolume: Math.max(...Object.values(buckets1).map((v) => v.bidVolume + v.askVolume)),
          highestDelta: Math.max(...Object.values(buckets1).map((v) => Math.abs(v.delta))),
          footprint: buckets1,
        },
      },
      {
        time: (date.getTime() / 1000 + 60) as Time,
        low: 4,
        high: 15,
        open: 5,
        close: 12,
        customValues: {
          totalVolume: Object.values(buckets2).reduce((acc, curr) => acc + curr.bidVolume + curr.askVolume, 0),
          highestVolume: Math.max(...Object.values(buckets2).map((v) => v.bidVolume + v.askVolume)),
          highestDelta: Math.max(...Object.values(buckets2).map((v) => Math.abs(v.delta))),
          footprint: buckets2,
        },
      },
      {
        time: (date.getTime() / 1000 + 120) as Time,
        low: 2,
        high: 13,
        open: 12,
        close: 6,
        customValues: {
          totalVolume: Object.values(buckets3).reduce((acc, curr) => acc + curr.bidVolume + curr.askVolume, 0),
          highestVolume: Math.max(...Object.values(buckets3).map((v) => v.bidVolume + v.askVolume)),
          highestDelta: Math.max(...Object.values(buckets3).map((v) => Math.abs(v.delta))),
          footprint: buckets3,
        },
      },
    ]);

    // center date on the screen

    chart.timeScale().fitContent();
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
