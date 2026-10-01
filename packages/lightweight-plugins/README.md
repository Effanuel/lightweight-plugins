# @effanuel/lightweight-plugins

Plugins for [TradingView Lightweight Charts™](https://github.com/tradingview/lightweight-charts) v5: series primitives, a price-line tool, and custom series, in one tree-shakeable ES module.

## Install

```sh
pnpm add @effanuel/lightweight-plugins lightweight-charts
```

`lightweight-charts` `^5.0.0` is a peer dependency. The package is ESM-only.

## Usage

Primitives attach to an existing series:

```ts
import { createChart, LineSeries } from 'lightweight-charts';
import { TrendLine } from '@effanuel/lightweight-plugins';

const chart = createChart(document.getElementById('chart')!);
const series = chart.addSeries(LineSeries);
series.setData(data);

series.attachPrimitive(
	new TrendLine(
		chart,
		series,
		{ time: data[10].time, price: data[10].value },
		{ time: data[40].time, price: data[40].value },
		{ lineColor: '#d50000', width: 2 },
	),
);
```

Custom series are added with `addCustomSeries`:

```ts
import { HeatMapSeries, type HeatMapData } from '@effanuel/lightweight-plugins';

const data: HeatMapData[] = [
	{ time: '2024-01-02', cells: [{ low: 10, high: 20, amount: 40 }, { low: 20, high: 30, amount: 90 }] },
];
chart.addCustomSeries(new HeatMapSeries()).setData(data);
```

Each plugin's options and data types are exported next to it (for example `TrendLineOptions`, `HeatMapData`).

## Plugins

| Export | Kind | What it does | Links |
|---|---|---|---|
| `AnchoredText` | primitive | Text anchored to a fixed spot in the pane, e.g. a watermark | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/anchored-text/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/anchored-text) |
| `BandsIndicator` | primitive | Upper and lower bands around the series with a filled area | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/bands-indicator/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/bands-indicator) |
| `CrosshairHighlightPrimitive` | primitive | Highlights the bar under the crosshair | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/highlight-bar-crosshair/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/highlight-bar-crosshair) |
| `OverlayPriceScale` | primitive | A price scale drawn as an overlay inside the pane | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/overlay-price-scale/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/overlay-price-scale) |
| `PartialPriceLine` | primitive | Last-value price line that spans only part of the pane | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/partial-price-line/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/partial-price-line) |
| `SessionHighlighting` | primitive | Colours each bar's background from a callback, e.g. by trading session | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/session-highlighting/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/session-highlighting) |
| `TrendLine` | primitive | Line between two time/price points, with optional price labels | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/trend-line/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/trend-line) |
| `UserPriceLines` | tool | Hover the price scale and click the "+" button to add a price line | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/user-price-lines/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/user-price-lines) |
| `VolumeProfile` | primitive | Volume-at-price histogram anchored to a point in time | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/volume-profile/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/volume-profile) |
| `BackgroundShadeSeries` | custom series | Shades the background between two colours by value | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/background-shade-series/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/background-shade-series) |
| `WhiskerBoxSeries` | custom series | Box-and-whisker (quartiles) plot per bar | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/box-whisker-series/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/box-whisker-series) |
| `GroupedBarsSeries` | custom series | Several bars side by side per time point | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/grouped-bars-series/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/grouped-bars-series) |
| `HeatMapSeries` | custom series | Heatmap cells over price ranges per bar | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/heatmap-series/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/heatmap-series) |
| `LollipopSeries` | custom series | Lollipop chart: a stem and a dot per value | [demo](https://tradingview.github.io/lightweight-charts/plugin-examples/plugins/lollipop-series/example/) · [source](https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/lollipop-series) |

## License

Apache-2.0. The plugins are TradingView's `plugin-examples` from lightweight-charts v5.2.1, unmodified apart from file location, except `UserPriceLines`, which creates its icon path lazily so the package can be imported without a DOM. See [NOTICE](./NOTICE).
