# @vecordis/lightweight-plugins

Mouse-driven drawing tools for [TradingView Lightweight Charts™](https://github.com/tradingview/lightweight-charts) v5: horizontal line, horizontal ray, vertical line, trend line, box, Fibonacci, path, free draw and measure, with selection, dragging, undo/redo, copy/paste and marquee select. No framework required.

Demo: https://lightweight-plugins.vercel.app/

## Install

```sh
pnpm add @vecordis/lightweight-plugins lightweight-charts
```

`lightweight-charts` `^5.0.0` is a peer dependency. The package is ESM-only.

0.2.0 removes the 0.1.x TradingView example plugins; stay on 0.1.x if you need them.

## Usage

```ts
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { DrawingManager } from '@vecordis/lightweight-plugins';

// Drawings default to white lines, made for a dark chart.
const chart = createChart(container, {
  layout: { background: { color: '#141722' }, textColor: '#d1d4dc' },
});
const series = chart.addSeries(CandlestickSeries);
series.setData(candles); // times must be UTCTimestamp (seconds)

const drawings = new DrawingManager(chart, series);
drawings.setTool('trend'); // the user clicks twice on the chart
// On a light chart, give each tool a dark style: drawings.setToolStyle('trend', { color: '#131722' });

// Later: destroy the manager before removing the chart.
drawings.destroy();
chart.remove();
```

Use one `DrawingManager` per chart.

Tools: `'select' | 'h-line' | 'h-ray' | 'v-line' | 'trend' | 'box' | 'fibonacci' | 'path' | 'free-draw' | 'measure'`.

| Member | |
|---|---|
| `new DrawingManager(chart, series, { tickSize?, keyboard? })` | `tickSize` defaults to the series' `priceFormat.minMove`; `keyboard` (default `true`) enables the shortcuts below |
| `setTool(tool \| null)`, `getTool()` | arm / disarm a tool |
| `getDrawings()`, `setDrawings(list)` | serializable drawings (`{ kind, id, …, style }`); `setDrawings` replaces all, clears undo history, and throws, changing nothing, on an unknown kind, a bad/duplicate id or malformed fields |
| `clear()`, `setHidden(b)`, `isHidden()` | clear all (undoable), hide/show |
| `getSelection()`, `setStyle(patch)`, `deleteSelected()` | style keys are `color width pattern opacity` for lines, `borderColor borderWidth borderOpacity bgColor bgOpacity` for boxes |
| `setToolStyle(tool, patch)` | style for that tool's next drawings |
| `undo()`, `redo()`, `copy()`, `paste()` | |
| `on('change' \| 'toolChange' \| 'selectionChange', cb)` | returns an unsubscribe function; `change` fires on every edit, including each mousemove of a drag |
| `destroy()` | detaches everything; call it before `chart.remove()` |

Saving drawings is up to you. `change` fires many times a second during a drag, so debounce it:

```ts
let saveTimer: ReturnType<typeof setTimeout> | undefined;
drawings.on('change', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => localStorage.setItem('d', JSON.stringify(drawings.getDrawings())), 300);
});
```

## Mouse and keyboard

One click places a horizontal line, ray or vertical line; trend, box, Fibonacci and measure take two clicks; path takes a click per point and finishes on a click near the last one; free draw is press-drag-release (Escape to stop). Drag a drawing to move it, drag a handle to reshape, Alt+drag to duplicate. Ctrl/Cmd+drag or the `select` tool marquee-selects. Delete/Backspace, Escape, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y, Ctrl/Cmd+C/V work for the chart that was clicked last. Touch input is not supported.

## License

Apache-2.0.
