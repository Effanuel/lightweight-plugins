"use client";

import React, { useEffect } from "react";
import useChart from "@/hooks/useChart";
import { Candle } from "@/types/candle";
import { ChartOptions } from "./chart-options";

interface Props {
  candles: Candle[];
}

export default function Chart(props: Props) {
  const { createChart, createCandlesticks } = useChart();
  const chartDiv = React.useRef(null);

  useEffect(() => {
    if (!chartDiv.current) {
      throw new Error("Chart div doesnt exist");
    }

    const chart = createChart(chartDiv.current, ChartOptions);
    createCandlesticks(props.candles);
    centerVisibleRange(props.candles);

    return () => {
      chart.remove();
    };
  }, []);

  const centerVisibleRange = (data: Candle[]) => {
    const middlePoint = Math.floor(data.length / 2);
    const from = data[Math.max(0, middlePoint - 100)]?.time;
    const to = data[Math.min(data.length - 1, middlePoint + 100)]?.time;
    console.log(from, to);
    // from && to && chart.current?.timeScale()?.setVisibleRange({ from, to });
  };

  return (
    <div className="flex flex-col h-full w-full  border border-gray-500 bg-tw-blue m-4">
      <div id="toolbar" className="bg-white h-5" />
      <div className="flex flex-1 flex-col ">
        <div id="chart" ref={chartDiv} className="relative z-0 flex w-full flex-1" />
      </div>
    </div>
  );
}
