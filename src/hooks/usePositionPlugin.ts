import React from "react";
import { PositionPluginTool } from "@/plugins/position-plugin/position-plugin";
import { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";

export const ToolbarId = "toolbar";

export default function usePositionPlugin() {
  const tool = React.useRef<PositionPluginTool | null>(null);

  const create = (chart: IChartApi, series: ISeriesApi<SeriesType>) => {
    const toolbarElement = document.querySelector<HTMLDivElement>(`#${ToolbarId}`)!;
    tool.current = new PositionPluginTool(chart, series, toolbarElement, {
      onSubmit: (entry, stop, target) => {
        alert(`Entry: ${entry}\nStop: ${stop}\nTarget: ${target}`);
      },
    });
  };

  const remove = () => {
    tool.current?.remove();
  };

  return { tool, create, remove };
}
