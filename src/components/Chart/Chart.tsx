"use client";

import React, { useEffect } from "react";
import useChart from "@/hooks/useChart";
import { Candle } from "@/types/candle";
import { ChartOptions } from "./chart-options";
import usePositionPlugin, { ToolbarId } from "@/hooks/usePositionPlugin";

interface Props {
  candles: Candle[];
}

export default function Chart(props: Props) {
  const { createChart, createCandlesticks } = useChart();
  const positionPlugin = usePositionPlugin();
  const chartDiv = React.useRef(null);

  useEffect(() => {
    if (!chartDiv.current) {
      throw new Error("Chart div element doesnt exist");
    }

    const chart = createChart(chartDiv.current, ChartOptions);
    const series = createCandlesticks(props.candles, { priceLineVisible: false, priceFormat: { minMove: 0.01 } });
    positionPlugin.create(chart, series);

    return () => {
      chart.remove();
      positionPlugin.remove();
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-tw-blue">
      <div title="Position tool" id={ToolbarId} className="bg-[#141722] h-7 flex justify-center" />
      <div className="flex flex-1 flex-col border border-gray-500">
        <div id="chart" ref={chartDiv} className="relative z-0 flex w-full flex-1" />
      </div>
    </div>
  );
}
