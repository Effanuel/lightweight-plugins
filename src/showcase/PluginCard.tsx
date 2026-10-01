"use client";

import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { Badge } from "@/components/ui/badge";
import { ChartOptions } from "@/components/Chart/chart-options";
import type { Demo } from "./demos";

export default function PluginCard({ demo }: { demo: Demo }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const chartEl = chartRef.current;
    const errorEl = errorRef.current;
    if (!chartEl || !errorEl) return;

    const chart = createChart(chartEl, ChartOptions);
    try {
      demo.setup(chart);
    } catch (error) {
      console.error(`${demo.name} demo failed`, error);
      chartEl.hidden = true;
      errorEl.textContent = `Failed to render: ${error instanceof Error ? error.message : String(error)}`;
      errorEl.hidden = false;
    }
    return () => chart.remove();
  }, [demo]);

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-[#141722] p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="truncate font-mono text-sm font-semibold">{demo.name}</h2>
        <Badge variant="secondary">{demo.kind}</Badge>
      </header>
      <p className="text-sm text-muted-foreground">{demo.description}</p>
      <div ref={chartRef} className="relative h-[260px] w-full" />
      <p ref={errorRef} hidden className="py-24 text-center text-sm text-red-400" />
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Usage</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-3 text-xs">
          <code>{demo.code}</code>
        </pre>
      </details>
      <a href={demo.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline">
        Source ↗
      </a>
    </article>
  );
}
