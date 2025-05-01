"use client";

import React, { useEffect } from "react";
import { useChartContext } from "@/hooks/useChart";
import { ChartOptions } from "../Chart/chart-options";
import numeral from "numeral";

export default function LineChart() {
  const { createChart, createLineSeries } = useChartContext();
  const chartDiv = React.useRef(null);

  useEffect(() => {
    if (!chartDiv.current) {
      throw new Error("Chart div element doesnt exist");
    }

    const chart = createChart(chartDiv.current, { ...ChartOptions, height: 300, width: 1000 });
    createLineSeries([], {});

    chart.applyOptions({
      localization: {
        priceFormatter: (priceValue: number) => numeral(priceValue).format("0.[0]a"),
        timeFormatter: (timeValue: number) => {
          // show seconds
          const date = new Date(timeValue * 1000);
          return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        },
      },
    });

    return () => {
      chart.remove();
    };
  }, []);

  return (
    <div className="flex bg-tw-blue">
      <div className="flex flex-col border border-gray-500">
        <div id="chart" ref={chartDiv} className="relative z-0 flex flex-1" />
      </div>
    </div>
  );
}
