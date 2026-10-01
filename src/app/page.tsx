import DrawingDemo from "@/showcase/DrawingDemo";

const NPM_URL = "https://www.npmjs.com/package/@vecordis/lightweight-plugins";
const GITHUB_URL = "https://github.com/Effanuel/lightweight-plugins/tree/master/packages/lightweight-plugins";

const SHORTCUTS: [string, string][] = [
  ["Delete / Backspace", "delete the selection"],
  ["Escape", "cancel, disarm, deselect"],
  ["Ctrl+Z", "undo"],
  ["Ctrl+Shift+Z or Ctrl+Y", "redo"],
  ["Ctrl+C / Ctrl+V", "copy / paste"],
  ["Ctrl+drag", "marquee-select"],
  ["Alt+drag", "duplicate while dragging"],
  ["Right-click", "cancel the current drawing"],
];

const USAGE = `import { createChart, CandlestickSeries } from 'lightweight-charts';
import { DrawingManager } from '@vecordis/lightweight-plugins';

const chart = createChart(container);
const series = chart.addSeries(CandlestickSeries);
series.setData(candles); // times as UTCTimestamp seconds

const drawings = new DrawingManager(chart, series);
drawings.setTool('trend');                 // then click twice on the chart
drawings.on('change', () => save(drawings.getDrawings()));
drawings.setDrawings(load());              // restore saved drawings`;

export default function Home() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="break-all font-mono text-2xl font-bold">@vecordis/lightweight-plugins</h1>
          <p className="text-muted-foreground">Drawing tools for TradingView Lightweight Charts v5.</p>
          <pre className="w-fit max-w-full overflow-x-auto rounded bg-black/40 px-3 py-2 text-sm">
            <code>pnpm add @vecordis/lightweight-plugins lightweight-charts</code>
          </pre>
          <nav className="flex gap-4 text-sm">
            <a href={NPM_URL} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
              npm
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
              GitHub
            </a>
          </nav>
        </header>

        <p className="hidden rounded border border-border px-3 py-2 text-sm text-muted-foreground pointer-coarse:block">
          Drawing needs a mouse; on a touch screen you can look at the drawings but not make new ones.
        </p>

        <DrawingDemo />

        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-2 font-semibold">Shortcuts</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {SHORTCUTS.map(([key, what]) => (
                <div key={key} className="contents">
                  <dt className="font-mono text-gray-300">{key}</dt>
                  <dd className="text-muted-foreground">{what}</dd>
                </div>
              ))}
            </dl>
          </div>
          <details className="min-w-0 text-sm">
            <summary className="mb-2 cursor-pointer font-semibold">Usage</summary>
            <pre className="overflow-x-auto rounded bg-black/40 p-3 text-xs">
              <code>{USAGE}</code>
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}
