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
  const { chart, createChart, createCandlesticks } = useChart();
  const { create, remove } = usePositionPlugin();
  const chartDiv = React.useRef(null);

  useEffect(() => {
    if (!chartDiv.current) {
      throw new Error("Chart div doesnt exist");
    }

    const chart = createChart(chartDiv.current, ChartOptions);
    const series = createCandlesticks(props.candles);
    centerVisibleRange(props.candles);
    create(chart, series);

    return () => {
      chart.remove();
      remove();
    };
  }, []);

  const centerVisibleRange = (data: Candle[]) => {
    const middlePoint = Math.floor(data.length / 2);
    const from = data[Math.max(0, middlePoint - 100)]?.time;
    const to = data[Math.min(data.length - 1, middlePoint + 100)]?.time;
    from && to && chart?.current?.timeScale()?.setVisibleRange({ from, to });
  };

  return (
    <div className="flex flex-col h-full w-full bg-tw-blue">
      <div title="Position tool" id={ToolbarId} className="bg-[#141722] h-7 flex justify-center" />
      <div className="flex flex-1 flex-col border border-gray-500">
        <div id="chart" ref={chartDiv} className="relative z-0 flex w-full flex-1" />
      </div>
    </div>
  );
}
