"use client";

import React, { useEffect } from "react";
import { useCvdChartContext } from "@/hooks/useCvdCharts";
import { ChartOptions } from "../Chart/chart-options";
import numeral from "numeral";

export default function CvdCandleChart() {
  const { createCvdCandleChart, createCvdCandleSeries } = useCvdChartContext();
  const chartDiv = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartDiv.current) {
      throw new Error("Chart div element doesnt exist");
    }

    const chart = createCvdCandleChart(chartDiv.current, { ...ChartOptions, height: 300, width: 1000 });
    createCvdCandleSeries([]);

    chart.applyOptions({
      localization: {
        priceFormatter: (priceValue: number) => numeral(priceValue).format("0.[0]a"),
        timeFormatter: (timeValue: number) =>
          new Date(timeValue * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
    });

    return () => {
      chart.remove();
    };
  }, []);

  return (
    <div className="flex bg-tw-blue">
      <div className="flex flex-col border border-gray-500">
        <div id="cvd-candle-chart" ref={chartDiv} className="relative z-0 flex flex-1" />
      </div>
    </div>
  );
}
