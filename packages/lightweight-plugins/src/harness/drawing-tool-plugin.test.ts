import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  createDrawingToolPlugin,
  type DrawingToolConfig,
  type StoreSlice,
} from "./drawing-tool-plugin";
import type { DrawingSample } from "./drawing-gesture-geometry";
import type { ChartGeometry, GestureVerdict } from "./chart-gesture";
import type { ChartPluginContext, ToolEnv } from "./chart-plugin";
import type { BoxData, BoxStyle } from "../model";
import { makeEnv } from "../tools/test-fixture";

// The harness is exercised through the box slice of the real drawings store —
// the canonical richest tool — with a fake primitive, fake geometry, and
// synthetic events. No chart mount, no React.

type Hit = { kind: "corner" | "body"; id: number };
type DragCtx = { id: number };

const STYLE: BoxStyle = {
  borderColor: "#111111",
  borderWidth: 1,
  borderOpacity: 1,
  bgColor: "#222222",
  bgOpacity: 0.1,
};

function boxAt(id: number): BoxData {
  return { id, p1: { price: 10, time: 100 }, p2: { price: 20, time: 200 }, style: { ...STYLE } };
}

let env: ToolEnv;

function makeSlice(): StoreSlice<BoxData> {
  return env.drawings.slice("box");
}

function makePrimitive() {
  const state = {
    selectedId: null as number | null,
    applied: [] as BoxData[][],
    dragging: [] as boolean[],
    hovered: [] as (number | null)[],
  };
  return {
    state,
    select: (id: number | null) => {
      state.selectedId = id;
    },
    selectedId: () => state.selectedId,
    selectedItem: () => env.drawings.items("box").find((b) => b.id === state.selectedId) ?? null,
    selectedY: () => 42,
    setDragging: (d: boolean) => {
      state.dragging.push(d);
    },
    setHovered: (id: number | null) => {
      state.hovered.push(id);
    },
    applyData: (items: BoxData[]) => {
      state.applied.push(items);
    },
  };
}

function makeGeometry(): ChartGeometry<DrawingSample> {
  return {
    paneCoords: (e: MouseEvent) => ({ x: e.clientX, y: e.clientY }),
    sampleAt: (x, y) => ({ x, y, time: x * 10, rawPrice: y, magnetPrice: y + 0.5 }),
    lockScroll: vi.fn(),
  };
}

type Fired = { type: string; listener: (e: never) => void };

function makeDom(shared?: { document: Fired[]; window: Fired[] }) {
  const targets = {
    container: [] as Fired[],
    document: shared?.document ?? ([] as Fired[]),
    window: shared?.window ?? ([] as Fired[]),
  };
  const record = (bucket: Fired[]) => ({
    addEventListener: (type: string, listener: (e: never) => void) => {
      bucket.push({ type, listener });
    },
    removeEventListener: (type: string, listener: (e: never) => void) => {
      const i = bucket.findIndex((f) => f.type === type && f.listener === listener);
      if (i >= 0) bucket.splice(i, 1);
    },
  });
  const win = record(targets.window);
  const doc = { ...record(targets.document), defaultView: win };
  const container = { ...record(targets.container), ownerDocument: doc };
  const fire = (where: keyof typeof targets, type: string, e: unknown) => {
    for (const f of [...targets[where]]) if (f.type === type) f.listener(e as never);
  };
  return { container, fire, targets };
}

function mouse(x: number, y: number, extra: Record<string, unknown> = {}) {
  return {
    clientX: x,
    clientY: y,
    button: 0,
    defaultPrevented: false,
    altKey: false,
    preventDefault: vi.fn(function (this: { defaultPrevented: boolean }) {
      this.defaultPrevented = true;
    }),
    stopImmediatePropagation: vi.fn(),
    ...extra,
  } as unknown as MouseEvent;
}

function key(k: string, target?: unknown) {
  return {
    key: k,
    target,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

const ctx = { chart: {}, series: {}, container: {} } as unknown as ChartPluginContext;

type Overrides = {
  creation?: DrawingToolConfig<BoxData, BoxStyle, Hit, DragCtx>["creation"];
  gesture?: DrawingToolConfig<BoxData, BoxStyle, Hit, DragCtx>["gesture"];
  hover?: DrawingToolConfig<BoxData, BoxStyle, Hit, DragCtx>["hover"];
};

function buildTool(
  overrides: Overrides = {},
  shared?: { document: Fired[]; window: Fired[] },
) {
  const primitive = makePrimitive();
  const geometry = makeGeometry();
  const channel = { preview: vi.fn(), drop: vi.fn(), clear: vi.fn() };
  const remember = vi.fn();
  const hitTestRef: { current: (x: number, y: number) => Hit | null } = { current: () => null };
  const onHitRef: { current: (hit: Hit, e: MouseEvent) => GestureVerdict<DragCtx> } = {
    current: (hit) => ({ kind: "drag", channel: "move", ctx: { id: hit.id } }),
  };

  const config: DrawingToolConfig<BoxData, BoxStyle, Hit, DragCtx> = {
    env,
    name: "test-tool",
    tool: "box",
    primitive,
    primitives: () => [],
    slice: makeSlice(),
    style: { get: () => ({ ...STYLE }), remember },
    gesture: () => ({
      hitTest: (x, y) => hitTestRef.current(x, y),
      onHit: (hit, e) => onHitRef.current(hit, e),
      channels: { move: channel },
    }),
    creation:
      overrides.creation ??
      (() => ({
        mode: "one-click",
        create: (s, id, style) => ({
          id,
          p1: { price: s.rawPrice ?? 0, time: s.time ?? 0 },
          p2: { price: s.rawPrice ?? 0, time: s.time ?? 0 },
          style,
        }),
      })),
    hover: overrides.hover ?? (() => ({ id: null, precision: "body" })),
    geometry: () => geometry,
  };

  const api = createDrawingToolPlugin(config);
  const dom = makeDom(shared);
  const teardown = api.plugin.onMount!({ ...ctx, container: dom.container as never });
  return { api, primitive, geometry, channel, remember, hitTestRef, onHitRef, dom, teardown };
}

beforeEach(() => {
  env = makeEnv();
});

describe("drawing-tool plugin — store sync", () => {
  test("mount pushes store items to the primitive; hidden pushes empty", () => {
    env.drawings.add("box", boxAt(1));
    const { primitive } = buildTool();

    expect(primitive.state.applied.at(-1)).toEqual([boxAt(1)]);

    env.drawings.setHidden(!env.drawings.isHidden());
    expect(primitive.state.applied.at(-1)).toEqual([]);
  });

  test("a drawings-store change re-syncs the primitive", () => {
    const { primitive } = buildTool();
    env.drawings.add("box", boxAt(7));
    expect(primitive.state.applied.at(-1)).toEqual([boxAt(7)]);
  });

});

describe("drawing-tool plugin — one-click creation", () => {
  test("mousedown with the tool active creates, selects, and disarms the tool", () => {
    env.tools.setActiveTool("box");
    const { api, dom } = buildTool();
    const e = mouse(30, 15);

    dom.fire("container", "mousedown", e);

    const items = env.drawings.items("box");
    expect(items).toHaveLength(1);
    expect(items[0].p1).toEqual({ price: 15, time: 300 }); // from the fake sample
    expect(items[0].style).toEqual(STYLE);
    expect(env.tools.activeTool).toBeNull();
    expect(api.getSelected()?.id).toBe(items[0].id);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopImmediatePropagation).toHaveBeenCalled();
  });

  test("mousedown while another tool is active is inert", () => {
    env.tools.setActiveTool("trend");
    const { dom } = buildTool();

    dom.fire("container", "mousedown", mouse(30, 15));

    expect(env.drawings.items("box")).toHaveLength(0);
    expect(env.tools.activeTool).toBe("trend");
  });
});

describe("drawing-tool plugin — two-click creation", () => {
  function twoClick() {
    const previewStep = vi.fn();
    const clearPreview = vi.fn();
    const built = buildTool({
      creation: () => ({
        mode: "two-click",
        previewStep,
        clearPreview,
        create: (anchor, s, id, style) => ({
          id,
          p1: { price: anchor.rawPrice ?? 0, time: anchor.time ?? 0 },
          p2: { price: s.rawPrice ?? 0, time: s.time ?? 0 },
          style,
        }),
      }),
    });
    return { ...built, previewStep, clearPreview };
  }

  test("first click anchors and locks scroll without creating", () => {
    env.tools.setActiveTool("box");
    const { dom, geometry } = twoClick();

    dom.fire("container", "mousedown", mouse(10, 20));

    expect(env.drawings.items("box")).toHaveLength(0);
    expect(geometry.lockScroll).toHaveBeenCalledWith(true);
    expect(env.tools.activeTool).toBe("box"); // still armed
  });

  test("moves after the anchor preview; second click creates and finishes", () => {
    env.tools.setActiveTool("box");
    const { api, dom, geometry, previewStep } = twoClick();

    dom.fire("container", "mousedown", mouse(10, 20));
    dom.fire("container", "mousemove", mouse(20, 30));
    expect(previewStep).toHaveBeenCalledTimes(1);

    dom.fire("container", "mousedown", mouse(30, 40));

    const items = env.drawings.items("box");
    expect(items).toHaveLength(1);
    expect(items[0].p1).toEqual({ price: 20, time: 100 });
    expect(items[0].p2).toEqual({ price: 40, time: 300 });
    expect(geometry.lockScroll).toHaveBeenLastCalledWith(false);
    expect(env.tools.activeTool).toBeNull();
    expect(api.getSelected()?.id).toBe(items[0].id);
  });

  test("Escape while anchored cancels the creation and disarms the tool", () => {
    env.tools.setActiveTool("box");
    const { dom, geometry, clearPreview } = twoClick();

    dom.fire("container", "mousedown", mouse(10, 20));
    dom.fire("document", "keydown", key("Escape"));

    expect(env.drawings.items("box")).toHaveLength(0);
    expect(clearPreview).toHaveBeenCalled();
    expect(geometry.lockScroll).toHaveBeenLastCalledWith(false);
    expect(env.tools.activeTool).toBeNull();

    // the anchor is really gone: re-arming and clicking twice needs both clicks again
    env.tools.setActiveTool("box");
    dom.fire("container", "mousedown", mouse(10, 20));
    expect(env.drawings.items("box")).toHaveLength(0);
  });

  test("contextmenu while anchored cancels the creation", () => {
    env.tools.setActiveTool("box");
    const { dom, clearPreview } = twoClick();
    const e = mouse(0, 0);

    dom.fire("container", "mousedown", mouse(10, 20));
    dom.fire("container", "contextmenu", e);

    expect(clearPreview).toHaveBeenCalled();
    expect(env.tools.activeTool).toBeNull();
    expect(e.preventDefault).toHaveBeenCalled();
  });

});

describe("drawing-tool plugin — drags", () => {
  test("a hit arms the channel: move previews the sample, release drops, dragging toggles", () => {
    env.drawings.add("box", boxAt(1));
    const { primitive, channel, hitTestRef, dom } = buildTool();
    hitTestRef.current = () => ({ kind: "corner", id: 1 });

    dom.fire("container", "mousedown", mouse(10, 20));
    expect(primitive.state.dragging.at(-1)).toBe(true);

    dom.fire("document", "mousemove", mouse(12, 25));
    expect(channel.preview).toHaveBeenCalledWith(
      { id: 1 },
      { x: 12, y: 25, time: 120, rawPrice: 25, magnetPrice: 25.5 },
    );

    dom.fire("window", "mouseup", mouse(12, 25));
    expect(channel.drop).toHaveBeenCalledWith(
      { id: 1 },
      { x: 12, y: 25, time: 120, rawPrice: 25, magnetPrice: 25.5 },
    );
    expect(primitive.state.dragging.at(-1)).toBe(false);
  });

  test("contextmenu during a drag cancels it without dropping", () => {
    env.drawings.add("box", boxAt(1));
    const { primitive, channel, hitTestRef, dom } = buildTool();
    hitTestRef.current = () => ({ kind: "corner", id: 1 });

    dom.fire("container", "mousedown", mouse(10, 20));
    dom.fire("document", "mousemove", mouse(12, 25));
    dom.fire("container", "contextmenu", mouse(12, 25));

    expect(channel.clear).toHaveBeenCalledWith({ id: 1 });
    expect(channel.drop).not.toHaveBeenCalled();
    expect(primitive.state.dragging.at(-1)).toBe(false);
  });

  test("onHit receives the mouse event (altKey for clone drags)", () => {
    env.drawings.add("box", boxAt(1));
    const { hitTestRef, onHitRef, dom } = buildTool();
    hitTestRef.current = () => ({ kind: "body", id: 1 });
    const seen: boolean[] = [];
    onHitRef.current = (hit, e) => {
      seen.push(e.altKey);
      return { kind: "done" };
    };

    dom.fire("container", "mousedown", mouse(10, 20, { altKey: true }));

    expect(seen).toEqual([true]);
  });

  test("an empty-pane click with a selection deselects", () => {
    env.drawings.add("box", boxAt(1));
    const { api, dom } = buildTool();
    api.select(1);

    dom.fire("container", "mousedown", mouse(10, 20)); // hitTest → null

    expect(api.getSelected()).toBeNull();
  });

  test("a click outside this surface's pane deselects and creates nothing", () => {
    env.drawings.add("box", boxAt(1));
    const { api, geometry, dom } = buildTool();
    geometry.paneCoords = () => null; // another pane / an axis
    api.select(1);

    dom.fire("container", "mousedown", mouse(10, 20));
    expect(api.getSelected()).toBeNull();

    env.tools.setActiveTool("box");
    dom.fire("container", "mousedown", mouse(10, 20));
    expect(env.drawings.items("box")).toHaveLength(1);
    expect(env.tools.activeTool).toBe("box"); // still armed
  });
});

describe("drawing-tool plugin — keyboard", () => {
  test("Delete removes the selected drawing and clears the selection", () => {
    env.drawings.add("box", boxAt(1));
    const { api, dom } = buildTool();
    api.select(1);
    const e = key("Delete");

    dom.fire("document", "keydown", e);

    expect(env.drawings.items("box")).toHaveLength(0);
    expect(api.getSelected()).toBeNull();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test("Escape with a plain selection just deselects", () => {
    env.drawings.add("box", boxAt(1));
    const { api, dom } = buildTool();
    api.select(1);

    dom.fire("document", "keydown", key("Escape"));

    expect(api.getSelected()).toBeNull();
    expect(env.drawings.items("box")).toHaveLength(1);
  });

  // The fib level editor's inputs (FibLevelsDropdown) live in a popup outside
  // the chart container, and this handler is bound on the document — so a
  // Backspace typed into a level used to delete the drawing being edited.
  test("Backspace typed into a text input leaves the selected drawing alone", () => {
    env.drawings.add("box", boxAt(1));
    const { api, dom } = buildTool();
    api.select(1);
    const e = key("Backspace", { tagName: "INPUT" });

    dom.fire("document", "keydown", e);

    expect(env.drawings.items("box")).toHaveLength(1);
    expect(api.getSelected()).not.toBeNull();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test("Escape typed into a text input does not deselect the drawing behind the popup", () => {
    env.drawings.add("box", boxAt(1));
    const { api, dom } = buildTool();
    api.select(1);

    dom.fire("document", "keydown", key("Escape", { tagName: "INPUT" }));

    expect(api.getSelected()).not.toBeNull();
  });
});

describe("drawing-tool plugin — selection and style", () => {
  test("select exposes {id, style, y} and notifies subscribers", () => {
    env.drawings.add("box", boxAt(1));
    const { api } = buildTool();
    const seen: unknown[] = [];
    api.onSelectionChange((s) => seen.push(s));

    api.select(1);

    expect(api.getSelected()).toEqual({ id: 1, style: STYLE, y: 42 });
    expect(seen).toEqual([{ id: 1, style: STYLE, y: 42 }]);

    api.closePopup();
    expect(api.getSelected()).toBeNull();
    expect(seen).toEqual([{ id: 1, style: STYLE, y: 42 }, null]);
  });

  test("handleStyleChange patches the store item, remembers the style, and updates the selection", () => {
    env.drawings.add("box", boxAt(1));
    const { api, remember } = buildTool();
    api.select(1);

    api.handleStyleChange({ borderColor: "#ff0000" });

    expect(env.drawings.items("box")[0].style.borderColor).toBe("#ff0000");
    expect(remember).toHaveBeenCalledWith({ borderColor: "#ff0000" });
    expect(api.getSelected()?.style.borderColor).toBe("#ff0000");
  });

  test("handleStyleChange without a selection is inert", () => {
    env.drawings.add("box", boxAt(1));
    const { api, remember } = buildTool();

    api.handleStyleChange({ borderColor: "#ff0000" });

    expect(env.drawings.items("box")[0].style.borderColor).toBe(STYLE.borderColor);
    expect(remember).not.toHaveBeenCalled();
  });
});

describe("drawing-tool plugin — hover", () => {
  test("idle mousemove reports the config's hover candidate to the primitive", async () => {
    env.drawings.add("box", boxAt(1));
    const { primitive, dom } = buildTool({ hover: () => ({ id: 1, precision: "corner" }) });

    dom.fire("container", "mousemove", mouse(10, 20));
    await Promise.resolve(); // reportHover resolves on a microtask

    expect(primitive.state.hovered.at(-1)).toBe(1);
  });

  test("moving off this surface's pane clears its hover", async () => {
    env.drawings.add("box", boxAt(1));
    const { primitive, geometry, dom } = buildTool({ hover: () => ({ id: 1, precision: "corner" }) });

    dom.fire("container", "mousemove", mouse(10, 20));
    await Promise.resolve();
    expect(primitive.state.hovered.at(-1)).toBe(1);

    geometry.paneCoords = () => null;
    dom.fire("container", "mousemove", mouse(10, 420));
    await Promise.resolve();
    expect(primitive.state.hovered.at(-1)).toBeNull();
  });
});

describe("drawing-tool plugin — one-click armed preview", () => {
  function oneClickWithPreview() {
    const preview = vi.fn();
    const clearPreview = vi.fn();
    const built = buildTool({
      creation: () => ({
        mode: "one-click",
        preview,
        clearPreview,
        create: (s, id, style) => ({
          id,
          p1: { price: s.rawPrice ?? 0, time: s.time ?? 0 },
          p2: { price: s.rawPrice ?? 0, time: s.time ?? 0 },
          style,
        }),
      }),
    });
    return { ...built, preview, clearPreview };
  }

  test("armed mousemove previews the sample at the cursor", () => {
    env.tools.setActiveTool("box");
    const { dom, preview } = oneClickWithPreview();

    dom.fire("container", "mousemove", mouse(20, 30));

    expect(preview).toHaveBeenCalledWith({ x: 20, y: 30, time: 200, rawPrice: 30, magnetPrice: 30.5 });
  });

  test("creating clears the armed preview", () => {
    env.tools.setActiveTool("box");
    const { dom, clearPreview } = oneClickWithPreview();

    dom.fire("container", "mousemove", mouse(20, 30));
    dom.fire("container", "mousedown", mouse(20, 30));

    expect(env.drawings.items("box")).toHaveLength(1);
    expect(clearPreview).toHaveBeenCalled();
  });

  test("Escape and mouseleave clear the armed preview", () => {
    env.tools.setActiveTool("box");
    const { dom, clearPreview } = oneClickWithPreview();

    dom.fire("container", "mousemove", mouse(20, 30));
    dom.fire("container", "mouseleave", mouse(0, 0));
    expect(clearPreview).toHaveBeenCalledTimes(1);

    dom.fire("container", "mousemove", mouse(20, 30));
    dom.fire("document", "keydown", key("Escape"));
    expect(clearPreview).toHaveBeenCalledTimes(2);
    expect(env.tools.activeTool).toBeNull();
  });
});

describe("drawing-tool plugin — unresolvable armed clicks pass through", () => {
  test("a null one-click create leaves the event unconsumed", () => {
    env.tools.setActiveTool("box");
    const { dom } = buildTool({
      creation: () => ({ mode: "one-click", create: () => null }),
    });
    const e = mouse(30, 15);

    dom.fire("container", "mousedown", e);

    expect(env.drawings.items("box")).toHaveLength(0);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(e.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(env.tools.activeTool).toBe("box");
  });

  test("a custom onMouseDown returning false leaves the event unconsumed; true consumes", () => {
    env.tools.setActiveTool("box");
    let handled = false;
    const { dom } = buildTool({
      creation: () => ({
        mode: "custom",
        onMouseDown: () => handled,
        cancel: vi.fn(),
      }),
    });

    const miss = mouse(30, 15);
    dom.fire("container", "mousedown", miss);
    expect(miss.preventDefault).not.toHaveBeenCalled();
    expect(miss.stopImmediatePropagation).not.toHaveBeenCalled();

    handled = true;
    const hit = mouse(30, 15);
    dom.fire("container", "mousedown", hit);
    expect(hit.preventDefault).toHaveBeenCalled();
    expect(hit.stopImmediatePropagation).toHaveBeenCalled();
  });

});

describe("drawing-tool plugin — two-click edge cases", () => {
  test("a rejected anchor (acceptAnchor false) leaves the tool armed and un-anchored", () => {
    env.tools.setActiveTool("box");
    const previewStep = vi.fn();
    const { dom, geometry } = buildTool({
      creation: () => ({
        mode: "two-click",
        acceptAnchor: (s) => s.x > 100,
        previewStep,
        clearPreview: vi.fn(),
        create: () => null,
      }),
    });

    dom.fire("container", "mousedown", mouse(10, 20)); // x=10 → rejected

    expect(geometry.lockScroll).not.toHaveBeenCalled();
    expect(env.tools.activeTool).toBe("box");
    dom.fire("container", "mousemove", mouse(20, 30));
    expect(previewStep).not.toHaveBeenCalled(); // nothing anchored
  });

  test("a null create on the second click keeps the anchor and the tool armed", () => {
    env.tools.setActiveTool("box");
    let allow = false;
    const previewStep = vi.fn();
    const { dom } = buildTool({
      creation: () => ({
        mode: "two-click",
        previewStep,
        clearPreview: vi.fn(),
        create: (anchor, s, id, style) =>
          allow ? { id, p1: { price: 1, time: 1 }, p2: { price: 2, time: 2 }, style } : null,
      }),
    });

    dom.fire("container", "mousedown", mouse(10, 20)); // anchor
    dom.fire("container", "mousedown", mouse(30, 40)); // create → null: anchor survives

    expect(env.drawings.items("box")).toHaveLength(0);
    expect(env.tools.activeTool).toBe("box");
    dom.fire("container", "mousemove", mouse(20, 30));
    expect(previewStep).toHaveBeenCalled(); // still anchored

    allow = true;
    dom.fire("container", "mousedown", mouse(30, 40));
    expect(env.drawings.items("box")).toHaveLength(1);
  });
});

describe("drawing-tool plugin — plugin surface", () => {
  test("plugin.primitives returns the configured series primitives", () => {
    const marker = { marker: true };
    const primitive = makePrimitive();
    const api = createDrawingToolPlugin<BoxData, BoxStyle, Hit, DragCtx>({
      env,
      name: "test-tool",
      tool: "box",
      primitive,
      primitives: () => [marker as never],
      slice: makeSlice(),
      style: { get: () => ({ ...STYLE }), remember: vi.fn() },
      gesture: () => ({ hitTest: () => null, onHit: () => ({ kind: "ignore" }), channels: {} }),
      creation: () => ({ mode: "one-click", create: () => null }),
      hover: () => ({ id: null, precision: "body" }),
    });

    expect(api.plugin.primitives()).toEqual([marker]);
  });

  test("onChartClick consumes only while the tool is armed", () => {
    const { api } = buildTool();

    env.tools.setActiveTool("box");
    expect(api.plugin.onChartClick!({} as never, ctx)).toBe("consumed");

    env.tools.setActiveTool(null);
    expect(api.plugin.onChartClick!({} as never, ctx)).toBe("pass");
  });

  test("teardown removes every listener it registered", () => {
    const { dom, teardown } = buildTool();
    expect(dom.targets.container.length + dom.targets.document.length + dom.targets.window.length).toBeGreaterThan(0);

    teardown();

    expect(dom.targets.container).toHaveLength(0);
    expect(dom.targets.document).toHaveLength(0);
    expect(dom.targets.window).toHaveLength(0);
  });
});

describe("drawing-tool plugin — undo grouping: drags", () => {
  const store = () => env.drawings;
  const boxes = () => store().items("box");

  // Box 1 lands outside the history, so every step a test sees is its own.
  function seedBox() {
    store().untracked(() => store().add("box", boxAt(1)));
  }

  // The move channel writes the store on every move, as the real drawing
  // channels do: the store is the drag preview.
  function draggable() {
    const built = buildTool();
    built.hitTestRef.current = () => ({ kind: "body", id: 1 });
    built.channel.preview.mockImplementation((c: DragCtx, s: DrawingSample) =>
      makeSlice().update(c.id, { p1: { price: s.rawPrice ?? 0, time: s.time ?? 0 } }),
    );
    return built;
  }

  test("a drag with 20 moves is one step", () => {
    seedBox();
    const { dom } = draggable();

    dom.fire("container", "mousedown", mouse(10, 20));
    for (let i = 1; i <= 20; i++) dom.fire("document", "mousemove", mouse(10 + i, 20 + i));
    dom.fire("window", "mouseup", mouse(30, 40));
    expect(boxes()[0].p1).toEqual({ price: 40, time: 300 });

    expect(store().undo()).toBe(true);
    expect(boxes()).toEqual([boxAt(1)]);
    expect(store().undo()).toBe(false);
  });

  test("a click without movement records no step and leaves no edit open", () => {
    seedBox();
    const { dom } = draggable();

    dom.fire("container", "mousedown", mouse(10, 20));
    dom.fire("window", "mouseup", mouse(10, 20));

    expect(boxes()).toEqual([boxAt(1)]);
    expect(store().undo()).toBe(false);
    // A later bare write is its own step: nothing was left open to swallow it.
    makeSlice().update(1, { p2: { price: 30, time: 300 } });
    expect(store().undo()).toBe(true);
  });

  test("a right-click cancel keeps the moved position as one step", () => {
    seedBox();
    const { dom } = draggable();

    dom.fire("container", "mousedown", mouse(10, 20));
    dom.fire("document", "mousemove", mouse(12, 25));
    dom.fire("document", "mousemove", mouse(14, 30));
    dom.fire("container", "contextmenu", mouse(14, 30));
    expect(boxes()[0].p1).toEqual({ price: 30, time: 140 });

    expect(store().undo()).toBe(true);
    expect(boxes()).toEqual([boxAt(1)]);
    expect(store().redo()).toBe(true);
    expect(boxes()[0].p1).toEqual({ price: 30, time: 140 });
  });

  test("an alt+drag clone and its move are one step; undo removes the clone only", () => {
    seedBox();
    const { dom, onHitRef } = draggable();
    // As the box tool does: clone inside onHit, then drag the copy.
    onHitRef.current = (hit, e) => {
      if (!e.altKey) return { kind: "drag", channel: "move", ctx: { id: hit.id } };
      makeSlice().add(boxAt(2));
      return { kind: "drag", channel: "move", ctx: { id: 2 } };
    };

    dom.fire("container", "mousedown", mouse(10, 20, { altKey: true }));
    dom.fire("document", "mousemove", mouse(12, 25));
    dom.fire("window", "mouseup", mouse(12, 25));
    expect(boxes().map((b) => b.id)).toEqual([1, 2]);
    expect(boxes()[1].p1).toEqual({ price: 25, time: 120 });

    expect(store().undo()).toBe(true);
    expect(boxes()).toEqual([boxAt(1)]);
    expect(store().undo()).toBe(false);
  });

  test("an instant action inside onHit is its own step", () => {
    seedBox();
    const { dom, onHitRef } = draggable();
    onHitRef.current = (hit) => {
      makeSlice().remove(hit.id);
      return { kind: "done" };
    };

    dom.fire("container", "mousedown", mouse(10, 20));
    expect(boxes()).toEqual([]);

    expect(store().undo()).toBe(true); // closed right away, not held open for a drag
    expect(boxes()).toEqual([boxAt(1)]);
  });

  test("teardown mid-drag closes the step", () => {
    seedBox();
    const { dom, teardown } = draggable();

    dom.fire("container", "mousedown", mouse(10, 20));
    dom.fire("document", "mousemove", mouse(11, 22));
    dom.fire("document", "mousemove", mouse(12, 25));
    teardown();

    expect(store().undo()).toBe(true);
    expect(boxes()).toEqual([boxAt(1)]);
  });

  test("a drag whose mouseup was lost is closed by the next mousedown", () => {
    seedBox();
    const { dom } = draggable();

    dom.fire("container", "mousedown", mouse(10, 20));
    dom.fire("document", "mousemove", mouse(11, 22));
    dom.fire("document", "mousemove", mouse(12, 25)); // released outside the window: no mouseup
    dom.fire("container", "mousedown", mouse(12, 25));
    dom.fire("document", "mousemove", mouse(13, 28));
    dom.fire("document", "mousemove", mouse(14, 30));
    dom.fire("window", "mouseup", mouse(14, 30));

    expect(store().undo()).toBe(true);
    expect(boxes()[0].p1).toEqual({ price: 25, time: 120 });
    expect(store().undo()).toBe(true);
    expect(boxes()).toEqual([boxAt(1)]);
  });
});

describe("drawing-tool plugin — undo grouping: popup sessions", () => {
  const store = () => env.drawings;
  const boxes = () => store().items("box");

  function seedBoxes(...ids: number[]) {
    store().untracked(() => ids.forEach((id) => store().add("box", boxAt(id))));
  }

  test("style changes while one popup stays open are one step; reopening starts another", () => {
    seedBoxes(1);
    const { api } = buildTool();

    api.select(1);
    api.handleStyleChange({ borderColor: "#aa0000" });
    api.handleStyleChange({ borderColor: "#bb0000" });
    api.handleStyleChange({ borderWidth: 3 });
    api.select(null);
    api.select(1);
    api.handleStyleChange({ bgColor: "#cc0000" });

    expect(store().undo()).toBe(true);
    expect(boxes()[0].style).toEqual({ ...STYLE, borderColor: "#bb0000", borderWidth: 3 });
    expect(store().undo()).toBe(true);
    expect(boxes()[0].style).toEqual(STYLE);
    expect(store().undo()).toBe(false);
  });

  test("editSelected joins the popup session's step", () => {
    seedBoxes(1);
    const { api } = buildTool();

    api.select(1);
    api.handleStyleChange({ borderColor: "#aa0000" });
    api.editSelected(() => makeSlice().update(1, { p1: { price: 11, time: 110 } }));
    api.handleStyleChange({ borderWidth: 3 });

    expect(store().undo()).toBe(true);
    expect(boxes()).toEqual([boxAt(1)]);
    expect(store().undo()).toBe(false);
  });

  test("popup sessions on different harness instances never merge", () => {
    seedBoxes(1, 2);
    const shared = { document: [] as Fired[], window: [] as Fired[] };
    const first = buildTool({}, shared);
    const second = buildTool({}, shared);

    first.api.select(1);
    first.api.handleStyleChange({ borderColor: "#aa0000" });
    second.api.select(2);
    second.api.handleStyleChange({ borderColor: "#bb0000" });

    expect(store().undo()).toBe(true);
    expect(boxes()[0].style.borderColor).toBe("#aa0000");
    expect(boxes()[1].style).toEqual(STYLE);
  });

  test("an undo deselects and closes the popup", () => {
    seedBoxes(1);
    const { api, primitive } = buildTool();
    const seen: unknown[] = [];
    api.onSelectionChange((s) => seen.push(s));

    api.select(1);
    api.handleStyleChange({ borderColor: "#aa0000" });
    expect(api.getSelected()?.id).toBe(1); // a plain store write keeps the selection

    expect(store().undo()).toBe(true);
    expect(api.getSelected()).toBeNull();
    expect(primitive.state.selectedId).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });
});
