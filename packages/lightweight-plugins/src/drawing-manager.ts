import type { ChartOptions, IChartApi, ISeriesApi, MouseEventParams, SeriesType, Time } from "lightweight-charts";
import type { ChartPlugin, ChartPluginContext, ToolEnv } from "./harness/chart-plugin";
import { createDrawingToolPlugin, type DrawingToolApi } from "./harness/drawing-tool-plugin";
import { createHoverArbiter } from "./harness/drawing-hover";
import { magnetSnap, registerChartEnv, timeAtX, type Bar } from "./lib/chart-measure";
import type { DrawingStyle } from "./lib/drawing-style";
import type { FibLevel } from "./lib/fib-levels";
import { DRAWING_KINDS, emptyBucket, type BoxStyle, type DrawingDataMap, type DrawingKind } from "./model";
import { DrawingStore } from "./store/drawing-store";
import { ToolState, type StyleSlot, type ToolName } from "./store/tool-state";
import { BoxToolPrimitive } from "./primitives/BoxToolPrimitive";
import { FibonacciPrimitive } from "./primitives/FibonacciPrimitive";
import { FreeDrawPrimitive } from "./primitives/FreeDrawPrimitive";
import { HorizontalLinePrimitive } from "./primitives/HorizontalLinePrimitive";
import { HorizontalRayPrimitive } from "./primitives/HorizontalRayPrimitive";
import { PathToolPrimitive } from "./primitives/PathToolPrimitive";
import { TrendLinePrimitive } from "./primitives/TrendLinePrimitive";
import { VerticalLinePrimitive } from "./primitives/VerticalLinePrimitive";
import { boxConfig } from "./tools/box";
import { fibConfig } from "./tools/fibonacci";
import { freeDrawConfig } from "./tools/free-draw";
import { hlineConfig } from "./tools/horizontal-line";
import { rayConfig } from "./tools/horizontal-ray";
import { pathConfig } from "./tools/path";
import { trendConfig } from "./tools/trend-line";
import { vlineConfig } from "./tools/vertical-line";
import { createMarqueeTool, type MarqueeTool } from "./tools/marquee";
import { createMeasureTool } from "./tools/measure";

export type { ToolName };

const KIND_TO_PUBLIC = {
  hline: "h-line",
  ray: "h-ray",
  vline: "v-line",
  trend: "trend",
  box: "box",
  fib: "fibonacci",
  path: "path",
  freedraw: "free-draw",
} as const satisfies Record<DrawingKind, string>;

export type DrawingKindName = (typeof KIND_TO_PUBLIC)[DrawingKind];

const PUBLIC_TO_KIND = Object.fromEntries(
  Object.entries(KIND_TO_PUBLIC).map(([kind, name]) => [name, kind]),
) as Record<DrawingKindName, DrawingKind>;

/** A stored drawing as the API hands it out: its data plus a `kind` tag. Serializable. */
export type Drawing = {
  [K in DrawingKind]: { kind: (typeof KIND_TO_PUBLIC)[K] } & DrawingDataMap[K];
}[DrawingKind];

export type DrawingManagerOptions = {
  /** Price grid drawings snap to. Defaults to the series' priceFormat.minMove, else 0.01. */
  tickSize?: number;
  /** Delete, Escape and copy/paste shortcuts. Default true. */
  keyboard?: boolean;
  /** Soft magnet: snap drawing points and the crosshair to a bar's OHLC within 8px. Default false. */
  magnet?: boolean;
};

type Events = {
  change: () => void;
  toolChange: (tool: ToolName | null) => void;
  selectionChange: (selection: Drawing[]) => void;
};

const DRAWING_STYLE_KEYS = ["width", "color", "pattern", "opacity"] as const;
const BOX_STYLE_KEYS = ["borderColor", "borderWidth", "borderOpacity", "bgColor", "bgOpacity"] as const;

/** The tools that make drawings. */
export type DrawingToolName = Exclude<ToolName, "select" | "measure" | "measure-pct">;

const STYLE_SLOT: Record<Exclude<DrawingToolName, "box">, StyleSlot> = {
  "h-line": "h-line",
  "h-ray": "h-ray",
  "v-line": "v-line",
  trend: "trend",
  fibonacci: "fibonacci",
  path: "path",
  "free-draw": "path",
};

// The manager whose chart last received a mousedown owns keyboard shortcuts.
let activeManager: symbol | null = null;

function readBars(series: ISeriesApi<SeriesType>): Bar[] {
  const bars: Bar[] = [];
  for (const item of series.data()) {
    if (typeof item.time !== "number") continue;
    const { open, high, low, close, value } = item as Omit<Bar, "time">;
    bars.push({ time: item.time, open, high, low, close, value });
  }
  return bars;
}

function seriesMinMove(series: ISeriesApi<SeriesType>): number {
  const format = series.options().priceFormat as { minMove?: number };
  return format.minMove && format.minMove > 0 ? format.minMove : 0.01;
}

const isNum = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function pointProblem(name: string, p: unknown): string | null {
  return isObj(p) && isNum(p.price) && isNum(p.time) ? null : `${name} must have finite price and time`;
}

/** Checks exactly FibLevel's fields: finite value, boolean visible, optional string color. */
function levelsProblem(levels: unknown): string | null {
  if (!Array.isArray(levels)) return "levels must be an array";
  for (const [i, l] of levels.entries()) {
    if (!isObj(l) || !isNum(l.value) || typeof l.visible !== "boolean" || (l.color !== undefined && typeof l.color !== "string")) {
      return `levels[${i}] must have a finite value, a boolean visible and an optional string color`;
    }
  }
  return null;
}

function stylesProblem(kind: DrawingKind, style: unknown): string | null {
  if (!isObj(style)) return "style must be an object";
  const strings = kind === "box" ? ["borderColor", "bgColor"] : ["color"];
  const numbers = kind === "box" ? ["borderWidth", "borderOpacity", "bgOpacity"] : ["width", "opacity"];
  for (const k of strings) if (typeof style[k] !== "string") return `style.${k} must be a string`;
  for (const k of numbers) if (!isNum(style[k])) return `style.${k} must be a finite number`;
  if (kind !== "box" && !["solid", "dashed", "dotted"].includes(style.pattern as string)) {
    return 'style.pattern must be "solid", "dashed" or "dotted"';
  }
  return null;
}

/** What is wrong with a drawing's data, or null when it is complete. */
function shapeProblem(kind: DrawingKind, d: object): string | null {
  const r = d as Record<string, unknown>;
  if (kind === "hline" || kind === "ray" || kind === "vline") {
    if (!isNum(r.price) || !isNum(r.time)) return "price and time must be finite numbers";
  } else if (kind === "trend" || kind === "box" || kind === "fib") {
    const bad = pointProblem("p1", r.p1) ?? pointProblem("p2", r.p2);
    if (bad) return bad;
    const levels = kind === "fib" && r.levels !== undefined ? levelsProblem(r.levels) : null;
    if (levels) return levels;
  } else {
    if (!Array.isArray(r.points)) return "points must be an array";
    for (const p of r.points) {
      const bad = pointProblem("each point", p);
      if (bad) return bad;
    }
    if (kind === "path" && typeof r.hasArrow !== "boolean") return "hasArrow must be a boolean";
  }
  return stylesProblem(kind, r.style);
}

function pick<T extends object>(patch: object, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) if (key in patch) out[key] = (patch as T)[key];
  return out;
}

/**
 * Mouse-driven drawing tools for one lightweight-charts series: arm a tool,
 * place drawings by clicking, drag to move or reshape, select, delete,
 * copy/paste and marquee-select. Times are UTCTimestamp seconds.
 */
export class DrawingManager {
  private readonly drawings = new DrawingStore();
  private readonly tools = new ToolState();
  private readonly apis: { kind: DrawingKind; api: DrawingToolApi<unknown> }[];
  private readonly marquee: MarqueeTool;
  private readonly listeners = new Map<keyof Events, Set<(...args: never[]) => void>>();
  private readonly teardown: () => void;
  private magnet: boolean;

  constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, options: DrawingManagerOptions = {}) {
    const keyboard = options.keyboard ?? true;
    this.magnet = options.magnet ?? false;
    const tickSize = () => options.tickSize ?? seriesMinMove(series);

    let bars = readBars(series);
    const onData = () => {
      bars = readBars(series);
    };
    series.subscribeDataChanged(onData);
    const unregister = registerChartEnv(chart, { getBars: () => bars, tickSize, magnet: () => this.magnet });

    const self = Symbol("drawing-manager"); // identity token for the active-manager check
    // The chart's own scroll/scale options while a gesture holds the lock, else null.
    // ponytail: one flag, not a depth count — tools unlock unconditionally (tool change, teardown).
    let beforeLock: Pick<ChartOptions, "handleScroll" | "handleScale"> | null = null;
    const env: ToolEnv = {
      drawings: this.drawings,
      tools: this.tools,
      tickSize,
      reportHover: createHoverArbiter(),
      keysActive: () => keyboard && activeManager === self,
      lockScroll: (locked) => {
        if (locked && !beforeLock) {
          // A copy: options() is the chart's live object, which the lock below merges into.
          const { handleScroll, handleScale } = chart.options();
          beforeLock = structuredClone({ handleScroll, handleScale });
          chart.applyOptions({ handleScroll: false, handleScale: false });
        } else if (!locked && beforeLock) {
          chart.applyOptions(beforeLock);
          beforeLock = null;
        }
      },
    };

    const prims = {
      hline: new HorizontalLinePrimitive(),
      ray: new HorizontalRayPrimitive(),
      vline: new VerticalLinePrimitive(),
      trend: new TrendLinePrimitive(),
      box: new BoxToolPrimitive(),
      fib: new FibonacciPrimitive(),
      path: new PathToolPrimitive(),
      freedraw: new FreeDrawPrimitive(),
    };
    this.apis = [
      { kind: "hline", api: createDrawingToolPlugin(hlineConfig(prims.hline, env)) },
      { kind: "ray", api: createDrawingToolPlugin(rayConfig(prims.ray, env)) },
      { kind: "vline", api: createDrawingToolPlugin(vlineConfig(prims.vline, env)) },
      { kind: "trend", api: createDrawingToolPlugin(trendConfig(prims.trend, env)) },
      { kind: "box", api: createDrawingToolPlugin(boxConfig(prims.box, env)) },
      { kind: "fib", api: createDrawingToolPlugin(fibConfig(prims.fib, env)) },
      { kind: "path", api: createDrawingToolPlugin(pathConfig(prims.path, env)) },
      { kind: "freedraw", api: createDrawingToolPlugin(freeDrawConfig(prims.freedraw, env)) },
    ];
    this.marquee = createMarqueeTool(env, prims);

    // Marquee first: its listeners must run before the tools' (it stops propagation).
    const plugins: ChartPlugin[] = [
      this.marquee.plugin,
      ...this.apis.map((a) => a.api.plugin),
      createMeasureTool(env, "measure"),
      createMeasureTool(env, "measure-pct"),
    ];

    const container = chart.chartElement();
    const ctx: ChartPluginContext = {
      chart,
      series,
      container,
      paneEl: () => {
        try {
          return chart.panes()[0]?.getHTMLElement() ?? null;
        } catch {
          return null;
        }
      },
    };

    const teardowns: (() => void)[] = [];
    for (const plugin of plugins) {
      for (const prim of plugin.primitives()) series.attachPrimitive(prim);
      if (plugin.onMount) teardowns.push(plugin.onMount(ctx));
    }

    const byPriority = plugins
      .filter((p) => p.onChartClick)
      .sort((a, b) => (b.clickPriority ?? 0) - (a.clickPriority ?? 0));
    const onClick = (param: MouseEventParams<Time>) => {
      for (const plugin of byPriority) if (plugin.onChartClick!(param, ctx) === "consumed") break;
    };
    chart.subscribeClick(onClick);

    // The magnet moves the crosshair onto the level a click would snap to.
    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      // Pointer moves only: lightweight-charts replays the crosshair, with no sourceEvent, on every data update.
      if (!param.sourceEvent || !param.point) return;
      if (param.paneIndex !== undefined && param.paneIndex !== series.getPane().paneIndex()) return;
      const price = magnetSnap(chart, series, param.point.x, param.point.y);
      const time = param.time ?? (timeAtX(chart, param.point.x) as Time | null);
      if (price != null && time != null) chart.setCrosshairPosition(price, time, series);
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    const activate = () => {
      activeManager = self;
    };
    container.addEventListener("mousedown", activate, true);
    if (activeManager === null) activeManager = self;

    // Set while a new single selection deselects everything else; those deselects notify too.
    let exclusive = false;
    const emitSelection = () => {
      if (!exclusive) this.emit("selectionChange", this.getSelection());
    };
    // One single selection at a time: a hit stops propagation, so the tools
    // mounted after the clicked one never see the click that should deselect them.
    const onToolSelection = (owner: DrawingToolApi<unknown>) => (sel: unknown) => {
      if (sel !== null && !exclusive) {
        exclusive = true;
        try {
          this.marquee.clear();
          for (const { api } of this.apis) if (api !== owner) api.select(null);
        } finally {
          exclusive = false;
        }
      }
      emitSelection();
    };
    const unsubs = [
      this.drawings.subscribe((s, prev) => {
        if (s.bucket !== prev.bucket) this.emit("change");
      }),
      this.tools.subscribe((tool) => this.emit("toolChange", tool)),
      this.marquee.onChange(emitSelection),
      ...this.apis.map(({ api }) => api.onSelectionChange(onToolSelection(api))),
    ];

    this.teardown = () => {
      for (const unsub of unsubs) unsub();
      container.removeEventListener("mousedown", activate, true);
      if (activeManager === self) activeManager = null;
      chart.unsubscribeClick(onClick);
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      for (const td of teardowns) td();
      for (const plugin of plugins) for (const prim of plugin.primitives()) series.detachPrimitive(prim);
      unregister();
      series.unsubscribeDataChanged(onData);
      this.listeners.clear();
    };
  }

  setTool(tool: ToolName | null): void {
    this.tools.setActiveTool(tool);
  }

  getTool(): ToolName | null {
    return this.tools.activeTool;
  }

  getDrawings(): Drawing[] {
    return DRAWING_KINDS.flatMap((kind) =>
      this.drawings.items(kind).map((item) => ({ kind: KIND_TO_PUBLIC[kind], ...structuredClone(item) }) as Drawing),
    ).sort((a, b) => a.id - b.id);
  }

  /** Replaces every drawing. Throws, changing nothing, on invalid input. */
  setDrawings(list: readonly Drawing[]): void {
    const bucket = emptyBucket();
    const seen = new Set<number>();
    for (const drawing of list) {
      const name = String((drawing as { kind: unknown }).kind);
      if (!Object.hasOwn(PUBLIC_TO_KIND, name)) throw new Error(`Unknown drawing kind "${name}"`);
      const kind = PUBLIC_TO_KIND[name as DrawingKindName];
      if (!Number.isSafeInteger(drawing.id) || drawing.id < 1) throw new Error(`Invalid drawing id ${String(drawing.id)}`);
      if (seen.has(drawing.id)) throw new Error(`Duplicate drawing id ${drawing.id}`);
      const problem = shapeProblem(kind, drawing);
      if (problem) throw new Error(`Invalid ${name} drawing ${drawing.id}: ${problem}`);
      seen.add(drawing.id);
      const item = structuredClone(drawing) as { kind?: string; id: number };
      delete item.kind;
      (bucket[kind] as { id: number }[]).push(item);
    }
    this.drawings.load(bucket);
  }

  /** Removes every drawing and unhides. */
  clear(): void {
    this.deselectAll();
    this.drawings.clearAll();
  }

  setHidden(hidden: boolean): void {
    this.drawings.setHidden(hidden);
  }

  isHidden(): boolean {
    return this.drawings.isHidden();
  }

  getSelection(): Drawing[] {
    const ids = this.selectedIds();
    return this.getDrawings().filter((d) => ids.get(PUBLIC_TO_KIND[d.kind])?.has(d.id));
  }

  /** Restyles the selection; each drawing takes only the keys its style type has. */
  setStyle(patch: Partial<DrawingStyle & BoxStyle>): void {
    for (const [kind, ids] of this.selectedIds()) {
      const picked = kind === "box" ? pick<BoxStyle>(patch, BOX_STYLE_KEYS) : pick<DrawingStyle>(patch, DRAWING_STYLE_KEYS);
      if (Object.keys(picked).length === 0) continue;
      for (const item of this.drawings.items(kind)) {
        if (ids.has(item.id)) this.drawings.update(kind, item.id, { style: { ...item.style, ...picked } } as never);
      }
    }
  }

  /** The style a tool's next drawings get; the tool takes only the keys its style type has. */
  setToolStyle(tool: DrawingToolName, patch: Partial<DrawingStyle & BoxStyle>): void {
    if (tool === "box") this.tools.setLastUsedBoxStyle(pick<BoxStyle>(patch, BOX_STYLE_KEYS));
    else this.tools.setLastUsedStyle(STYLE_SLOT[tool], pick<DrawingStyle>(patch, DRAWING_STYLE_KEYS));
  }

  /** Sets the selected fibs' levels; new fibs get them too. Throws, changing nothing, on invalid levels. */
  setFibLevels(levels: readonly FibLevel[]): void {
    const problem = levelsProblem(levels);
    if (problem) throw new Error(`Invalid fib levels: ${problem}`);
    const copy = structuredClone(levels) as FibLevel[];
    this.tools.setFibLevels(copy);
    const ids = this.selectedIds().get("fib")!;
    for (const item of this.drawings.items("fib")) if (ids.has(item.id)) this.drawings.update("fib", item.id, { levels: copy });
  }

  /** Snap drawing points and the crosshair to the hovered bar's OHLC within 8px. */
  setMagnet(on: boolean): void {
    this.magnet = on;
  }

  getMagnet(): boolean {
    return this.magnet;
  }

  /**
   * Y of the clicked-to-select drawing, in px from the top of `chart.chartElement()`, as it was
   * when selected: where to anchor a settings popup. Null for no selection or a marquee selection.
   */
  getSelectionY(): number | null {
    const marquee = this.marquee.selection();
    if (DRAWING_KINDS.some((k) => marquee[k].size > 0)) return null;
    for (const { api } of this.apis) {
      const single = api.getSelected();
      if (single) return single.y;
    }
    return null;
  }

  /** Removes everything getSelection reports. */
  deleteSelected(): void {
    for (const [kind, ids] of this.selectedIds()) for (const id of ids) this.drawings.remove(kind, id);
    this.deselectAll();
  }

  copy(): boolean {
    return this.marquee.copy();
  }

  paste(): boolean {
    return this.marquee.paste();
  }

  on<E extends keyof Events>(event: E, cb: Events[E]): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(cb as (...args: never[]) => void);
    return () => {
      set.delete(cb as (...args: never[]) => void);
    };
  }

  destroy(): void {
    this.teardown();
  }

  private emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): void {
    for (const cb of [...(this.listeners.get(event) ?? [])]) (cb as (...a: Parameters<Events[E]>) => void)(...args);
  }

  private deselectAll(): void {
    this.marquee.clear();
    for (const { api } of this.apis) api.select(null);
  }

  private selectedIds(): Map<DrawingKind, Set<number>> {
    const marquee = this.marquee.selection();
    const out = new Map<DrawingKind, Set<number>>(DRAWING_KINDS.map((k) => [k, new Set(marquee[k])]));
    for (const { kind, api } of this.apis) {
      const single = api.getSelected();
      if (single) out.get(kind)!.add(single.id);
    }
    return out;
  }
}
