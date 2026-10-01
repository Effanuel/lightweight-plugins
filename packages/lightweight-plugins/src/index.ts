export { AnchoredText } from './plugins/anchored-text/anchored-text';
// Upstream doesn't export AnchoredText's options interface; derive it so consumers can name it.
export type AnchoredTextOptions = ConstructorParameters<
	typeof import('./plugins/anchored-text/anchored-text').AnchoredText
>[0];

export { BackgroundShadeSeries } from './plugins/background-shade-series/background-shade-series';
export type { BackgroundShadeSeriesOptions } from './plugins/background-shade-series/options';

export { BandsIndicator, type BandsIndicatorOptions } from './plugins/bands-indicator/bands-indicator';

export { WhiskerBoxSeries } from './plugins/box-whisker-series/box-whisker-series';
export type { WhiskerBoxSeriesOptions } from './plugins/box-whisker-series/options';
export type { WhiskerData } from './plugins/box-whisker-series/sample-data';

export { GroupedBarsSeries } from './plugins/grouped-bars-series/grouped-bars-series';
export type { GroupedBarsSeriesOptions } from './plugins/grouped-bars-series/options';
export type { GroupedBarsData } from './plugins/grouped-bars-series/data';

export { HeatMapSeries } from './plugins/heatmap-series/heatmap-series';
export type { HeatMapSeriesOptions, HeatMapCellShader } from './plugins/heatmap-series/options';
export type { HeatMapData, HeatmapCell } from './plugins/heatmap-series/data';

export {
	CrosshairHighlightPrimitive,
	type HighlightBarCrosshairOptions,
} from './plugins/highlight-bar-crosshair/highlight-bar-crosshair';

export { LollipopSeries } from './plugins/lollipop-series/lollipop-series';
export type { LollipopSeriesOptions } from './plugins/lollipop-series/options';
export type { LollipopData } from './plugins/lollipop-series/data';

export {
	OverlayPriceScale,
	type OverlayPriceScaleOptions,
} from './plugins/overlay-price-scale/overlay-price-scale';

export { PartialPriceLine } from './plugins/partial-price-line/partial-price-line';

export {
	SessionHighlighting,
	type SessionHighlightingOptions,
	type SessionHighlighter,
} from './plugins/session-highlighting/session-highlighting';

export { TrendLine, type TrendLineOptions } from './plugins/trend-line/trend-line';

export { UserPriceLines, type UserPriceLinesOptions } from './plugins/user-price-lines/user-price-lines';

export { VolumeProfile, type VolumeProfileData } from './plugins/volume-profile/volume-profile';
