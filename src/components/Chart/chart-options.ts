import {
  type ChartOptions as ChartOptionsI,
  type DeepPartial,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
} from "lightweight-charts";

const hex2rgba = (hex: string, alpha = 1) => {
  const rgb = hex.match(/\w\w/g)?.map((x) => parseInt(x, 16));
  if (rgb) {
    const [r, g, b] = rgb;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return "#FFFFF";
};

const twBlue = "#141722";
const twDarkGray = "#434651";

export const ChartOptions: DeepPartial<ChartOptionsI> = {
  autoSize: true,
  localization: {
    dateFormat: "yyyy-MM-dd",
  },
  layout: {
    background: { type: ColorType.Solid, color: twBlue },
    textColor: "white",
  },
  crosshair: {
    mode: CrosshairMode.Normal,
  },
  grid: {
    vertLines: { color: hex2rgba(twDarkGray, 0.3) },
    horzLines: { color: hex2rgba(twDarkGray, 0.3) },
  },
  rightPriceScale: {
    borderColor: hex2rgba(twDarkGray, 0.3),
    borderVisible: true,
    mode: PriceScaleMode.Logarithmic,
    ticksVisible: true,
  },
  timeScale: {
    shiftVisibleRangeOnNewBar: false,
    rightOffset: 12,
    fixLeftEdge: false,
    lockVisibleTimeRangeOnResize: true,
    rightBarStaysOnScroll: true,
    allowShiftVisibleRangeOnWhitespaceReplacement: false,
    borderVisible: true,
    borderColor: hex2rgba(twDarkGray, 0.3),
    visible: true,
    timeVisible: true,
    secondsVisible: false,
  },
};
