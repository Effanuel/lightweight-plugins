"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { CandlestickSeries, createChart } from "lightweight-charts";
import { BoxSelect, Eye, EyeOff, Pencil, Percent, Trash2 } from "lucide-react";
import { DrawingManager, type ToolName } from "@vecordis/lightweight-plugins";
import { DrawingSettings } from "@vecordis/lightweight-plugins/react";
import { ChartOptions } from "@/components/Chart/chart-options";
import { candleData } from "./sample-data";
import { seedDrawings } from "./seed-drawings";
import {
  BoxIcon,
  FibIcon,
  HLineIcon,
  HRayIcon,
  MagnetIcon,
  MeasureIcon,
  PathIcon,
  TrendIcon,
  VLineIcon,
} from "./tool-icons";

declare global {
  interface Window {
    drawings?: DrawingManager;
  }
}

// terminal-orderflow's toolbar order.
const TOOLS: { id: ToolName; label: string; hint?: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "select", label: "Select", hint: "drag a box, or Ctrl+drag", icon: BoxSelect },
  { id: "measure", label: "Measure", hint: "two clicks", icon: MeasureIcon },
  { id: "measure-pct", label: "Percentage", hint: "two clicks", icon: Percent },
  { id: "h-ray", label: "Horizontal ray", icon: HRayIcon },
  { id: "path", label: "Path", hint: "click points, click the last again to finish", icon: PathIcon },
  { id: "free-draw", label: "Free draw", hint: "press and drag; Esc to stop", icon: Pencil },
  { id: "box", label: "Box", hint: "two clicks", icon: BoxIcon },
  { id: "fibonacci", label: "Fibonacci", hint: "two clicks", icon: FibIcon },
  { id: "trend", label: "Trend line", hint: "two clicks", icon: TrendIcon },
  { id: "h-line", label: "Horizontal line", icon: HLineIcon },
  { id: "v-line", label: "Vertical line", icon: VLineIcon },
];

const button = "flex h-9 w-9 shrink-0 items-center justify-center rounded text-gray-300 hover:bg-white/10";

export default function DrawingDemo() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [manager, setManager] = useState<DrawingManager | null>(null);
  const [tool, setTool] = useState<ToolName | null>(null);
  const [hidden, setHidden] = useState(false);
  const [magnet, setMagnet] = useState(true);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const chart = createChart(el, ChartOptions);
    const series = chart.addSeries(CandlestickSeries);
    const candles = candleData();
    series.setData(candles);
    const m = new DrawingManager(chart, series, { magnet: true });
    m.setDrawings(seedDrawings(candles));
    const offs = [
      m.on("toolChange", setTool),
      // clear() also unhides, so read the hidden flag back on every change.
      m.on("change", () => setHidden(m.isHidden())),
    ];
    window.drawings = m;
    setManager(m);
    return () => {
      offs.forEach((off) => off());
      m.destroy();
      chart.remove();
      if (window.drawings === m) delete window.drawings;
    };
  }, []);

  const toggleHidden = () => {
    if (!manager) return;
    manager.setHidden(!hidden);
    setHidden(!hidden);
  };
  const toggleMagnet = () => {
    manager?.setMagnet(!magnet);
    setMagnet(!magnet);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2 md:flex-row">
      <div
        role="toolbar"
        aria-label="Drawing tools"
        className="flex shrink-0 flex-row gap-1 overflow-x-auto rounded-lg border border-border bg-[#141722] p-1 md:flex-col md:overflow-visible"
      >
        {TOOLS.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={tool === id}
            title={hint ? `${label} (${hint})` : label}
            onClick={() => manager?.setTool(tool === id ? null : id)}
            className={`${button} ${tool === id ? "bg-[#2962ff] text-white hover:bg-[#2962ff]" : ""}`}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
        <div className="mx-1 w-px shrink-0 bg-border md:mx-0 md:my-1 md:h-px md:w-auto" />
        <button
          type="button"
          aria-label={hidden ? "Show drawings" : "Hide drawings"}
          title={hidden ? "Show drawings" : "Hide drawings"}
          onClick={toggleHidden}
          className={button}
        >
          {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
        <button
          type="button"
          aria-label="Magnet"
          aria-pressed={magnet}
          title={magnet ? "Magnet: on (snap to OHLC)" : "Magnet: off"}
          onClick={toggleMagnet}
          className={`${button} ${magnet ? "bg-white/10 text-white" : "text-gray-500"}`}
        >
          <MagnetIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Clear all"
          title="Clear all"
          onClick={() => manager?.clear()}
          className={button}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
      {/* Not overflow-hidden: the settings menus may open past the chart's edge. */}
      <div className="relative h-[min(70vh,640px)] min-w-0 flex-1">
        <div id="chart" ref={chartRef} className="h-full w-full overflow-hidden rounded-lg border border-border" />
        {manager && <DrawingSettings manager={manager} />}
      </div>
    </div>
  );
}
