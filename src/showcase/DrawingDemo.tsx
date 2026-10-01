"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { CandlestickSeries, createChart } from "lightweight-charts";
import { BoxSelect, Eye, EyeOff, Pencil, Redo2, Trash2, Undo2, X } from "lucide-react";
import { DrawingManager, type Drawing, type ToolName } from "@vecordis/lightweight-plugins";
import { ChartOptions } from "@/components/Chart/chart-options";
import { candleData } from "./sample-data";
import { seedDrawings } from "./seed-drawings";
import { BoxIcon, FibIcon, HLineIcon, HRayIcon, MeasureIcon, PathIcon, TrendIcon, VLineIcon } from "./tool-icons";

declare global {
  interface Window {
    drawings?: DrawingManager;
  }
}

const TOOLS: { id: ToolName; label: string; hint?: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "select", label: "Select", hint: "drag a box, or Ctrl+drag", icon: BoxSelect },
  { id: "h-line", label: "Horizontal line", icon: HLineIcon },
  { id: "h-ray", label: "Horizontal ray", icon: HRayIcon },
  { id: "v-line", label: "Vertical line", icon: VLineIcon },
  { id: "trend", label: "Trend line", hint: "two clicks", icon: TrendIcon },
  { id: "box", label: "Box", hint: "two clicks", icon: BoxIcon },
  { id: "fibonacci", label: "Fibonacci", hint: "two clicks", icon: FibIcon },
  { id: "path", label: "Path", hint: "click points, click the last again to finish", icon: PathIcon },
  { id: "free-draw", label: "Free draw", hint: "press and drag; Esc to stop", icon: Pencil },
  { id: "measure", label: "Measure", hint: "two clicks", icon: MeasureIcon },
];

const COLORS = ["#ffffff", "#2962ff", "#f23645", "#089981", "#ff9800", "#9c27b0", "#ffeb3b", "#00bcd4"];
const WIDTHS = [1, 2, 3, 4];
const PATTERNS = ["solid", "dashed", "dotted"] as const;

const button = "flex h-9 w-9 shrink-0 items-center justify-center rounded text-gray-300 hover:bg-white/10";

export default function DrawingDemo() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [manager, setManager] = useState<DrawingManager | null>(null);
  const [tool, setTool] = useState<ToolName | null>(null);
  const [selection, setSelection] = useState<Drawing[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const chart = createChart(el, ChartOptions);
    const series = chart.addSeries(CandlestickSeries);
    const candles = candleData();
    series.setData(candles);
    const m = new DrawingManager(chart, series);
    m.setDrawings(seedDrawings(candles));
    const offs = [
      m.on("toolChange", setTool),
      m.on("selectionChange", setSelection),
      m.on("change", () => setSelection(m.getSelection())),
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
  const hasBox = selection.some((d) => d.kind === "box");

  return (
    <div className="flex min-w-0 flex-col gap-2">
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
          <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" onClick={() => manager?.undo()} className={button}>
            <Undo2 className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={() => manager?.redo()} className={button}>
            <Redo2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={hidden ? "Show drawings" : "Hide drawings"}
            title={hidden ? "Show drawings" : "Hide drawings"}
            onClick={toggleHidden}
            className={button}
          >
            {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          <button type="button" aria-label="Clear all" title="Clear all (undoable)" onClick={() => manager?.clear()} className={button}>
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
        <div
          id="chart"
          ref={chartRef}
          className="relative h-[min(70vh,640px)] min-w-0 flex-1 overflow-hidden rounded-lg border border-border"
        />
      </div>

      {selection.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-[#141722] px-3 py-2 text-sm">
          <span className="text-muted-foreground">{selection.length} selected</span>
          <div className="flex gap-1" aria-label="Colour">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => manager?.setStyle({ color: c, borderColor: c })}
                className="h-5 w-5 rounded-full border border-white/30"
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex gap-1" aria-label="Width">
            {WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => manager?.setStyle({ width: w, borderWidth: w })}
                className="rounded px-2 py-0.5 text-gray-300 hover:bg-white/10"
              >
                {w}px
              </button>
            ))}
          </div>
          <div className="flex gap-1" aria-label="Line style">
            {PATTERNS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => manager?.setStyle({ pattern: p })}
                className="rounded px-2 py-0.5 capitalize text-gray-300 hover:bg-white/10"
              >
                {p}
              </button>
            ))}
          </div>
          {hasBox && (
            <div className="flex items-center gap-1" aria-label="Fill">
              <span className="text-muted-foreground">Fill</span>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Fill ${c}`}
                  onClick={() => manager?.setStyle({ bgColor: c })}
                  className="h-5 w-5 rounded border border-white/30"
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => manager?.deleteSelected()}
            className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-red-400 hover:bg-white/10"
          >
            <X className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
