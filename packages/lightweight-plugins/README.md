# @vecordis/lightweight-plugins

Mouse-driven drawing tools for [TradingView Lightweight Charts™](https://github.com/tradingview/lightweight-charts) v5: horizontal line, horizontal ray, vertical line, trend line, box, Fibonacci, path, free draw and measure, with selection, dragging, undo/redo, copy/paste and marquee select. No framework required.

Demo: https://lightweight-plugins.vercel.app/

## Install

```sh
pnpm add @vecordis/lightweight-plugins lightweight-charts
```

`lightweight-charts` `^5.0.0` is a peer dependency. The package is ESM-only.

## Usage

```ts
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { DrawingManager } from '@vecordis/lightweight-plugins';

const chart = createChart(container);
const series = chart.addSeries(CandlestickSeries);
series.setData(candles); // times must be UTCTimestamp (seconds)

const drawings = new DrawingManager(chart, series);
drawings.setTool('trend'); // the user clicks twice on the chart
```

Tools: `'select' | 'h-line' | 'h-ray' | 'v-line' | 'trend' | 'box' | 'fibonacci' | 'path' | 'free-draw' | 'measure'`.

| Member | |
|---|---|
| `new DrawingManager(chart, series, { tickSize?, keyboard? })` | `tickSize` defaults to the series' `priceFormat.minMove`; `keyboard` (default `true`) enables the shortcuts below |
| `setTool(tool \| null)`, `getTool()` | arm / disarm a tool |
| `getDrawings()`, `setDrawings(list)` | serializable drawings (`{ kind, id, …, style }`); `setDrawings` replaces all, clears undo history, and throws on an unknown kind or a bad/duplicate id |
| `clear()`, `setHidden(b)`, `isHidden()` | clear all (undoable), hide/show |
| `getSelection()`, `setStyle(patch)`, `deleteSelected()` | style keys are `color width pattern opacity` for lines, `borderColor borderWidth borderOpacity bgColor bgOpacity` for boxes |
| `setToolStyle(tool, patch)` | style for that tool's next drawings |
| `undo()`, `redo()`, `copy()`, `paste()` | |
| `on('change' \| 'toolChange' \| 'selectionChange', cb)` | returns an unsubscribe function |
| `destroy()` | detaches everything |

Saving drawings is up to you, e.g. `drawings.on('change', () => localStorage.setItem('d', JSON.stringify(drawings.getDrawings())))`.

## Mouse and keyboard

One click places a horizontal line, ray or vertical line; trend, box, Fibonacci and measure take two clicks; path takes a click per point and finishes on a click near the last one; free draw is press-drag-release (Escape to stop). Drag a drawing to move it, drag a handle to reshape, Alt+drag to duplicate. Ctrl/Cmd+drag or the `select` tool marquee-selects. Delete/Backspace, Escape, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y, Ctrl/Cmd+C/V work for the chart that was clicked last. Touch input is not supported.

## License

Apache-2.0.
