import { RectangleDrawingTool } from "@/plugins/position-plugin/position-plugin";
import { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
import React from "react";

export const ToolbarId = "toolbar";

export default function usePositionPlugin() {
  const tool = React.useRef<RectangleDrawingTool | null>(null);

  const create = (chart: IChartApi, series: ISeriesApi<SeriesType>) => {
    tool.current = new RectangleDrawingTool(
      chart, //
      series,
      document.querySelector<HTMLDivElement>(`#${ToolbarId}`)!,
      { showLabels: false }
    );
  };

  const remove = () => {
    tool.current?.remove();
  };

  return { tool, create, remove };
}
