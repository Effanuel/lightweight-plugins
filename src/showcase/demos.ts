import { CandlestickSeries, LineSeries, type IChartApi, type Time, type UTCTimestamp } from "lightweight-charts";
import {
  AnchoredText,
  BackgroundShadeSeries,
  BandsIndicator,
  CrosshairHighlightPrimitive,
  GroupedBarsSeries,
  HeatMapSeries,
  LollipopSeries,
  OverlayPriceScale,
  PartialPriceLine,
  SessionHighlighting,
  TrendLine,
  UserPriceLines,
  VolumeProfile,
  WhiskerBoxSeries,
} from "@vecordis/lightweight-plugins";
import { candleData, groupedBarsData, heatmapData, lineData, whiskerData } from "./sample-data";

export type DemoKind = "primitive" | "tool" | "custom series";

export interface Demo {
  name: string;
  kind: DemoKind;
  description: string;
  /** Usage snippet shown on the card. */
  code: string;
  sourceUrl: string;
  setup: (chart: IChartApi) => void;
}

const source = (dir: string) =>
  `https://github.com/tradingview/lightweight-charts/tree/v5.2.1/plugin-examples/src/plugins/${dir}`;

const isWeekend = (time: Time) => [0, 6].includes(new Date((time as UTCTimestamp) * 1000).getUTCDay());

export const demos: Demo[] = [
  {
    name: "AnchoredText",
    kind: "primitive",
    description: "Text anchored to a fixed spot in the pane, e.g. a watermark.",
    sourceUrl: source("anchored-text"),
    code: `import { AnchoredText } from '@vecordis/lightweight-plugins';

series.attachPrimitive(
  new AnchoredText({
    text: 'Anchored Text',
    vertAlign: 'middle',
    horzAlign: 'middle',
    font: 'italic bold 32px Arial',
    lineHeight: 32,
    color: 'rgba(255, 255, 255, 0.3)',
  }),
);`,
    setup: (chart) => {
      const series = chart.addSeries(LineSeries);
      series.setData(lineData());
      series.attachPrimitive(
        new AnchoredText({
          text: "Anchored Text",
          vertAlign: "middle",
          horzAlign: "middle",
          font: "italic bold 32px Arial",
          lineHeight: 32,
          color: "rgba(255, 255, 255, 0.3)",
        }),
      );
    },
  },
  {
    name: "BandsIndicator",
    kind: "primitive",
    description: "Upper and lower bands (±10% of each value) around the series, with a filled area.",
    sourceUrl: source("bands-indicator"),
    code: `import { BandsIndicator } from '@vecordis/lightweight-plugins';

series.attachPrimitive(new BandsIndicator({ lineColor: 'rgb(25, 200, 100)', lineWidth: 1 }));`,
    setup: (chart) => {
      const series = chart.addSeries(LineSeries);
      series.setData(lineData());
      series.attachPrimitive(new BandsIndicator());
    },
  },
  {
    name: "CrosshairHighlightPrimitive",
    kind: "primitive",
    description: "Highlights the bar under the crosshair. Hover the chart.",
    sourceUrl: source("highlight-bar-crosshair"),
    code: `import { CrosshairHighlightPrimitive } from '@vecordis/lightweight-plugins';

// Switches the crosshair to Normal mode and hides its vertical line.
series.attachPrimitive(new CrosshairHighlightPrimitive({ color: 'rgba(255, 255, 255, 0.1)' }));`,
    setup: (chart) => {
      const series = chart.addSeries(CandlestickSeries);
      series.setData(candleData());
      series.attachPrimitive(new CrosshairHighlightPrimitive({ color: "rgba(255, 255, 255, 0.1)" }));
    },
  },
  {
    name: "OverlayPriceScale",
    kind: "primitive",
    description: "A price scale drawn as an overlay inside the pane.",
    sourceUrl: source("overlay-price-scale"),
    code: `import { OverlayPriceScale } from '@vecordis/lightweight-plugins';

const series = chart.addSeries(LineSeries, { priceScaleId: 'overlay' });
series.attachPrimitive(new OverlayPriceScale({ side: 'left' }));`,
    setup: (chart) => {
      chart.applyOptions({ rightPriceScale: { visible: false }, grid: { horzLines: { visible: false } } });
      const series = chart.addSeries(LineSeries, { priceScaleId: "overlay" });
      series.setData(lineData());
      series.attachPrimitive(
        new OverlayPriceScale({ textColor: "rgb(220, 220, 220)", backgroundColor: "rgba(20, 23, 34, 0.6)" }),
      );
    },
  },
  {
    name: "PartialPriceLine",
    kind: "primitive",
    description: "Last-value price line that spans only part of the pane.",
    sourceUrl: source("partial-price-line"),
    code: `import { PartialPriceLine } from '@vecordis/lightweight-plugins';

// Draws from the last bar to the price scale, so leave room on the right.
chart.timeScale().applyOptions({ rightOffset: 10 });
series.attachPrimitive(new PartialPriceLine());`,
    setup: (chart) => {
      chart.timeScale().applyOptions({ rightOffset: 10 });
      const series = chart.addSeries(LineSeries);
      series.setData(lineData());
      series.attachPrimitive(new PartialPriceLine());
    },
  },
  {
    name: "SessionHighlighting",
    kind: "primitive",
    description: "Colours each bar's background from a callback; here weekends vs weekdays.",
    sourceUrl: source("session-highlighting"),
    code: `import { SessionHighlighting } from '@vecordis/lightweight-plugins';

series.attachPrimitive(
  new SessionHighlighting((time) => (isWeekend(time) ? 'rgba(255, 152, 1, 0.15)' : 'rgba(41, 98, 255, 0.15)')),
);`,
    setup: (chart) => {
      const series = chart.addSeries(CandlestickSeries);
      series.setData(candleData());
      series.attachPrimitive(
        new SessionHighlighting((time) => (isWeekend(time) ? "rgba(255, 152, 1, 0.15)" : "rgba(41, 98, 255, 0.15)")),
      );
    },
  },
  {
    name: "TrendLine",
    kind: "primitive",
    description: "Line between two time/price points, with optional price labels.",
    sourceUrl: source("trend-line"),
    code: `import { TrendLine } from '@vecordis/lightweight-plugins';

series.attachPrimitive(
  new TrendLine(chart, series, { time: t1, price: 95 }, { time: t2, price: 120 }, { lineColor: '#FF9800', width: 2 }),
);`,
    setup: (chart) => {
      const series = chart.addSeries(LineSeries);
      const data = lineData();
      series.setData(data);
      const [a, b] = [data[data.length - 30], data[data.length - 5]];
      series.attachPrimitive(
        new TrendLine(
          chart,
          series,
          { time: a.time, price: a.value * 0.95 },
          { time: b.time, price: b.value * 1.05 },
          { lineColor: "#FF9800", width: 2, labelBackgroundColor: "rgba(20, 23, 34, 0.85)", labelTextColor: "white" },
        ),
      );
      // Same bars in view at every card width, so neither end's price label is clipped.
      chart.timeScale().setVisibleLogicalRange({ from: data.length - 60, to: data.length + 25 });
    },
  },
  {
    name: "UserPriceLines",
    kind: "tool",
    description: 'Hover the chart just left of the price scale and click the "+" button to add a price line.',
    sourceUrl: source("user-price-lines"),
    code: `import { UserPriceLines } from '@vecordis/lightweight-plugins';

// Attaches itself: don't pass it to attachPrimitive. Call .remove() to clean up.
const tool = new UserPriceLines(chart, series, { color: 'hotpink' });`,
    setup: (chart) => {
      const series = chart.addSeries(LineSeries);
      series.setData(lineData());
      new UserPriceLines(chart, series, { color: "hotpink" });
    },
  },
  {
    name: "VolumeProfile",
    kind: "primitive",
    description: "Volume-at-price histogram anchored to a point in time.",
    sourceUrl: source("volume-profile"),
    code: `import { VolumeProfile } from '@vecordis/lightweight-plugins';

const profile = [{ price: 98, vol: 4 }, { price: 100, vol: 12 }, { price: 102, vol: 7 }];
series.attachPrimitive(new VolumeProfile(chart, series, { time, profile, width: 10 }));`,
    setup: (chart) => {
      const series = chart.addSeries(CandlestickSeries);
      const data = candleData();
      series.setData(data);
      const anchor = data[data.length - 30];
      const step = anchor.close * 0.01;
      const profile = Array.from({ length: 15 }, (_, i) => ({
        price: anchor.close + (i - 7) * step,
        vol: Math.round(20 * Math.exp(-((i - 7) ** 2) / 12)),
      }));
      series.attachPrimitive(new VolumeProfile(chart, series, { time: anchor.time, profile, width: 10 }));
    },
  },
  {
    name: "BackgroundShadeSeries",
    kind: "custom series",
    description: "Shades the background between two colours by value.",
    sourceUrl: source("background-shade-series"),
    code: `import { BackgroundShadeSeries } from '@vecordis/lightweight-plugins';

// data: { time, value }[]
chart.addCustomSeries(new BackgroundShadeSeries(), { lowValue: 0, highValue: 200 }).setData(data);
chart.addSeries(LineSeries).setData(data);`,
    setup: (chart) => {
      const data = lineData();
      const values = data.map((d) => d.value);
      chart
        .addCustomSeries(new BackgroundShadeSeries(), {
          lowValue: Math.min(...values),
          highValue: Math.max(...values),
          opacity: 0.4,
        })
        .setData(data);
      chart.addSeries(LineSeries, { color: "white" }).setData(data);
    },
  },
  {
    name: "WhiskerBoxSeries",
    kind: "custom series",
    description: "Box-and-whisker (quartiles) plot per bar.",
    sourceUrl: source("box-whisker-series"),
    code: `import { WhiskerBoxSeries } from '@vecordis/lightweight-plugins';

// data: { time, quartiles: [min, q1, median, q3, max], outliers? }[]
chart.addCustomSeries(new WhiskerBoxSeries(), { priceLineVisible: false }).setData(data);`,
    setup: (chart) => {
      chart
        .addCustomSeries(new WhiskerBoxSeries(), {
          baseLineColor: "",
          priceLineVisible: false,
          lastValueVisible: false,
          whiskerColor: "rgba(186, 104, 200, 1)",
        })
        .setData(whiskerData());
    },
  },
  {
    name: "GroupedBarsSeries",
    kind: "custom series",
    description: "Several bars side by side per time point.",
    sourceUrl: source("grouped-bars-series"),
    code: `import { GroupedBarsSeries } from '@vecordis/lightweight-plugins';

// data: { time, values: number[] }[]
chart.addCustomSeries(new GroupedBarsSeries(), { colors: ['#2962FF', '#E1575A', '#F28E2C'] }).setData(data);`,
    setup: (chart) => {
      chart.applyOptions({ timeScale: { barSpacing: 16, minBarSpacing: 8, rightOffset: 1 } });
      chart.addCustomSeries(new GroupedBarsSeries(), { color: "white" }).setData(groupedBarsData());
    },
  },
  {
    name: "HeatMapSeries",
    kind: "custom series",
    description: "Heatmap cells over price ranges per bar.",
    sourceUrl: source("heatmap-series"),
    code: `import { HeatMapSeries } from '@vecordis/lightweight-plugins';

// data: { time, cells: { low, high, amount }[] }[]
// Colour cells yourself with the cellShader option: (amount) => cssColor.
chart.addCustomSeries(new HeatMapSeries()).setData(data);`,
    setup: (chart) => {
      chart.applyOptions({ timeScale: { barSpacing: 10, rightOffset: 1 } });
      chart.addCustomSeries(new HeatMapSeries()).setData(heatmapData());
    },
  },
  {
    name: "LollipopSeries",
    kind: "custom series",
    description: "Lollipop chart: a stem and a dot per value.",
    sourceUrl: source("lollipop-series"),
    code: `import { LollipopSeries } from '@vecordis/lightweight-plugins';

// data: { time, value }[]
chart.addCustomSeries(new LollipopSeries(), { lineWidth: 2 }).setData(data);`,
    setup: (chart) => {
      // Stems start at zero, so use values spread over 20-100 rather than a walk around 100.
      const data = groupedBarsData(40, 1, 7).map(({ time, values: [value] }) => ({ time, value }));
      chart.addCustomSeries(new LollipopSeries(), { lineWidth: 2 }).setData(data);
    },
  },
];
