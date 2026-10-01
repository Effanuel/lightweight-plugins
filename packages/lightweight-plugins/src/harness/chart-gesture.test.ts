import { describe, test, expect, vi } from "vitest";
import {
  ChartGestureController,
  type ChartGeometry,
  type GestureVerdict,
} from "./chart-gesture";

type Hit = { type: string; id: string };
type Ctx = { id: string };

// A scriptable fake chart so the gesture state machine is the test surface —
// no chart mount, just synthetic MouseEvents. The fake's sampleAt is the
// adapter seam: it returns the price for a pane coordinate, pre-validated and
// pre-snapped (that's the adapter's job, not the controller's).
function makeGeometry(overrides: Partial<ChartGeometry<number>> = {}) {
  const lockScroll = vi.fn();
  return {
    // paneCoords reads e.clientX/clientY verbatim by default
    paneCoords: (e: MouseEvent) => ({ x: e.clientX, y: e.clientY }),
    // identity-ish: sample equals the y coordinate by default
    sampleAt: (_x: number, y: number) => y,
    lockScroll,
    ...overrides,
  };
}

function makeChannel() {
  return { preview: vi.fn(), drop: vi.fn(), clear: vi.fn() };
}

function mouse(x: number, y: number): MouseEvent {
  return { clientX: x, clientY: y, preventDefault: vi.fn() } as unknown as MouseEvent;
}

function build(
  onHit: (hit: Hit) => GestureVerdict<Ctx>,
  channels: Record<string, ReturnType<typeof makeChannel>>,
  geometry = makeGeometry(),
  hitTest: (x: number, y: number) => Hit | null = (_x, y) => ({ type: "line", id: `o${y}` }),
) {
  const controller = new ChartGestureController<Hit, Ctx>(geometry, {
    hitTest,
    onHit,
    channels,
  });
  return { controller, geometry, channels };
}

describe("ChartGestureController — hit dispatch", () => {
  test("ignore verdict arms no drag and does not lock scroll", () => {
    const ch = makeChannel();
    const { controller, geometry } = build(() => ({ kind: "ignore" }), { line: ch });

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseMove(mouse(10, 30));

    expect(geometry.lockScroll).not.toHaveBeenCalled();
    expect(ch.preview).not.toHaveBeenCalled();
  });

  test("done verdict prevents default but does not lock scroll or arm a drag", () => {
    const ch = makeChannel();
    const { controller, geometry } = build(() => ({ kind: "done" }), { line: ch });
    const e = mouse(10, 20);

    controller.handleMouseDown(e);
    controller.handleMouseMove(mouse(10, 30));

    expect(e.preventDefault).toHaveBeenCalled();
    expect(geometry.lockScroll).not.toHaveBeenCalled();
    expect(ch.preview).not.toHaveBeenCalled();
  });

  test("hit outside the pane (paneCoords null) dispatches nothing", () => {
    const ch = makeChannel();
    const onHit = vi.fn(() => ({ kind: "done" }) as GestureVerdict<Ctx>);
    const geometry = makeGeometry({ paneCoords: () => null });
    const controller = new ChartGestureController<Hit, Ctx>(geometry, {
      hitTest: () => ({ type: "line", id: "o1" }),
      onHit,
      channels: { line: ch },
    });

    controller.handleMouseDown(mouse(999, 20));

    expect(onHit).not.toHaveBeenCalled();
  });

  test("no hit target dispatches nothing", () => {
    const ch = makeChannel();
    const onHit = vi.fn(() => ({ kind: "done" }) as GestureVerdict<Ctx>);
    const { controller } = build(onHit, { line: ch }, makeGeometry(), () => null);

    controller.handleMouseDown(mouse(10, 20));

    expect(onHit).not.toHaveBeenCalled();
  });
});

describe("ChartGestureController — drag lifecycle", () => {
  test("arming a drag locks scroll and prevents default", () => {
    const ch = makeChannel();
    const { controller, geometry } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" } }),
      { line: ch },
    );
    const e = mouse(10, 20);

    controller.handleMouseDown(e);

    expect(geometry.lockScroll).toHaveBeenCalledWith(true);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test("moving after arm previews exactly what sampleAt returned", () => {
    const ch = makeChannel();
    // the fake adapter snaps: tick 10
    const geometry = makeGeometry({ sampleAt: (_x, y) => Math.round(y / 10) * 10 });
    const { controller } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" } }),
      { line: ch },
      geometry,
    );

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseMove(mouse(10, 24)); // adapter snaps 24 → 20

    expect(ch.preview).toHaveBeenCalledWith({ id: "o1" }, 20);
  });

  test("a moved release drops with the last previewed sample, not a mouseup recompute", () => {
    const ch = makeChannel();
    const { controller, geometry } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" } }),
      { line: ch },
    );

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseMove(mouse(10, 55)); // last preview sample = 55
    controller.handleMouseUp(); // mouseup elsewhere must NOT change the sample

    expect(ch.drop).toHaveBeenCalledWith({ id: "o1" }, 55);
    expect(geometry.lockScroll).toHaveBeenLastCalledWith(false);
  });

  test("a moved release does not auto-clear — drop owns its own clear (in-flight preview)", () => {
    const ch = makeChannel();
    const { controller } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" } }),
      { line: ch },
    );

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseMove(mouse(10, 30));
    controller.handleMouseUp();

    expect(ch.drop).toHaveBeenCalledTimes(1);
    expect(ch.clear).not.toHaveBeenCalled();
  });

  test("a no-move release clears the channel and fires onClick, never drops", () => {
    const ch = makeChannel();
    const onClick = vi.fn();
    const { controller, geometry } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" }, onClick }),
      { line: ch },
    );

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseUp(); // no move

    expect(ch.clear).toHaveBeenCalledWith({ id: "o1" });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(ch.drop).not.toHaveBeenCalled();
    expect(geometry.lockScroll).toHaveBeenLastCalledWith(false);
  });

  test("a no-move release without onClick still clears", () => {
    const ch = makeChannel();
    const { controller } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" } }),
      { line: ch },
    );

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseUp();

    expect(ch.clear).toHaveBeenCalledWith({ id: "o1" });
    expect(ch.drop).not.toHaveBeenCalled();
  });

  test("a null sample during move is skipped — release stays a no-move click", () => {
    const ch = makeChannel();
    const onClick = vi.fn();
    const geometry = makeGeometry({ sampleAt: () => null });
    const { controller } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" }, onClick }),
      { line: ch },
      geometry,
    );

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseMove(mouse(10, 30)); // sample null → skipped, moved stays false
    controller.handleMouseUp();

    expect(ch.preview).not.toHaveBeenCalled();
    expect(ch.drop).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("off-pane move is skipped — release stays a no-move click", () => {
    const ch = makeChannel();
    const onClick = vi.fn();
    let paneNull = false;
    const geometry = makeGeometry({
      paneCoords: (e) => (paneNull ? null : { x: e.clientX, y: e.clientY }),
    });
    const { controller } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" }, onClick }),
      { line: ch },
      geometry,
    );

    controller.handleMouseDown(mouse(10, 20));
    paneNull = true;
    controller.handleMouseMove(mouse(10, 30)); // off pane → skipped
    controller.handleMouseUp();

    expect(ch.preview).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("only the armed channel is touched; sibling channels stay idle", () => {
    const a = makeChannel();
    const b = makeChannel();
    const { controller } = build(
      () => ({ kind: "drag", channel: "a", ctx: { id: "o1" } }),
      { a, b },
    );

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseMove(mouse(10, 30));
    controller.handleMouseUp();

    expect(a.drop).toHaveBeenCalledTimes(1);
    expect(b.preview).not.toHaveBeenCalled();
    expect(b.drop).not.toHaveBeenCalled();
    expect(b.clear).not.toHaveBeenCalled();
  });

  test("move and up with no armed drag are inert", () => {
    const ch = makeChannel();
    const { controller, geometry } = build(() => ({ kind: "ignore" }), { line: ch });

    controller.handleMouseMove(mouse(10, 30));
    controller.handleMouseUp();

    expect(ch.preview).not.toHaveBeenCalled();
    expect(ch.drop).not.toHaveBeenCalled();
    expect(geometry.lockScroll).not.toHaveBeenCalled();
  });
});

describe("ChartGestureController — non-price samples", () => {
  type Point = { price: number; time: number };

  test("a 2D {price,time} sample flows preview → drop verbatim", () => {
    const preview = vi.fn();
    const drop = vi.fn();
    const clear = vi.fn();
    const geometry: ChartGeometry<Point> = {
      paneCoords: (e: MouseEvent) => ({ x: e.clientX, y: e.clientY }),
      sampleAt: (x, y) => ({ price: y * 2, time: x * 100 }),
      lockScroll: vi.fn(),
    };
    const controller = new ChartGestureController<Hit, Ctx, Point>(geometry, {
      hitTest: () => ({ type: "corner", id: "b1" }),
      onHit: () => ({ kind: "drag", channel: "corner", ctx: { id: "b1" } }),
      channels: { corner: { preview, drop, clear } },
    });

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseMove(mouse(12, 25));
    controller.handleMouseUp();

    expect(preview).toHaveBeenCalledWith({ id: "b1" }, { price: 50, time: 1200 });
    expect(drop).toHaveBeenCalledWith({ id: "b1" }, { price: 50, time: 1200 });
    expect(clear).not.toHaveBeenCalled();
  });

  test("2D sample null (e.g. time not resolvable) skips the move", () => {
    const preview = vi.fn();
    const drop = vi.fn();
    const clear = vi.fn();
    const geometry: ChartGeometry<Point> = {
      paneCoords: (e: MouseEvent) => ({ x: e.clientX, y: e.clientY }),
      sampleAt: () => null,
      lockScroll: vi.fn(),
    };
    const controller = new ChartGestureController<Hit, Ctx, Point>(geometry, {
      hitTest: () => ({ type: "corner", id: "b1" }),
      onHit: () => ({ kind: "drag", channel: "corner", ctx: { id: "b1" } }),
      channels: { corner: { preview, drop, clear } },
    });

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseMove(mouse(12, 25));
    controller.handleMouseUp();

    expect(preview).not.toHaveBeenCalled();
    expect(drop).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledWith({ id: "b1" }); // no-move click path
  });
});

describe("ChartGestureController — onHit event access", () => {
  test("onHit receives the originating mouse event (e.g. for altKey checks)", () => {
    const ch = makeChannel();
    const onHit = vi.fn(() => ({ kind: "ignore" }) as GestureVerdict<Ctx>);
    const { controller } = build(onHit, { line: ch });
    const e = { ...mouse(10, 20), altKey: true } as unknown as MouseEvent;

    controller.handleMouseDown(e);

    expect(onHit).toHaveBeenCalledWith({ type: "line", id: "o20" }, e);
  });
});

describe("ChartGestureController — cancelActive", () => {
  test("cancelling an in-flight drag clears the channel, unlocks scroll, and does not consume", () => {
    const ch = makeChannel();
    const { controller, geometry } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" } }),
      { line: ch },
    );

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseMove(mouse(10, 30));
    controller.cancelActive();

    expect(ch.clear).toHaveBeenCalledWith({ id: "o1" });
    expect(ch.drop).not.toHaveBeenCalled();
    expect(geometry.lockScroll).toHaveBeenLastCalledWith(false);
    expect(controller.wasGestureConsumed()).toBe(false);

    // the drag is fully disarmed: a later mouseup is inert
    controller.handleMouseUp();
    expect(ch.drop).not.toHaveBeenCalled();
    expect(ch.clear).toHaveBeenCalledTimes(1);
  });

  test("cancelActive with no armed drag is inert", () => {
    const ch = makeChannel();
    const { controller, geometry } = build(() => ({ kind: "ignore" }), { line: ch });

    controller.cancelActive();

    expect(ch.clear).not.toHaveBeenCalled();
    expect(geometry.lockScroll).not.toHaveBeenCalled();
  });
});

describe("ChartGestureController — isActive", () => {
  test("reports an armed drag until release or cancel", () => {
    const ch = makeChannel();
    const { controller } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" } }),
      { line: ch },
    );

    expect(controller.isActive()).toBe(false);
    controller.handleMouseDown(mouse(10, 20));
    expect(controller.isActive()).toBe(true);
    controller.handleMouseUp();
    expect(controller.isActive()).toBe(false);

    controller.handleMouseDown(mouse(10, 20));
    controller.cancelActive();
    expect(controller.isActive()).toBe(false);
  });
});

describe("ChartGestureController — consumed flag", () => {
  test("a moved drop marks the gesture consumed exactly once", () => {
    const ch = makeChannel();
    const { controller } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" } }),
      { line: ch },
    );

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseMove(mouse(10, 30));
    controller.handleMouseUp();

    expect(controller.wasGestureConsumed()).toBe(true);
    expect(controller.wasGestureConsumed()).toBe(false); // reset after read
  });

  test("a no-move click does not consume the gesture", () => {
    const ch = makeChannel();
    const { controller } = build(
      () => ({ kind: "drag", channel: "line", ctx: { id: "o1" }, onClick: vi.fn() }),
      { line: ch },
    );

    controller.handleMouseDown(mouse(10, 20));
    controller.handleMouseUp();

    expect(controller.wasGestureConsumed()).toBe(false);
  });
});

describe("ChartGestureController — attach", () => {
  test("attach wires listeners and teardown unlocks scroll", () => {
    const ch = makeChannel();
    const geometry = makeGeometry();
    const controller = new ChartGestureController<Hit, Ctx>(geometry, {
      hitTest: () => ({ type: "line", id: "o1" }),
      onHit: () => ({ kind: "drag", channel: "line", ctx: { id: "o1" } }),
      channels: { line: ch },
    });

    const container = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
    const doc = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document;

    const teardown = controller.attach(container, doc);
    expect(container.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(doc.addEventListener).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(doc.addEventListener).toHaveBeenCalledWith("mouseup", expect.any(Function));

    teardown();
    expect(container.removeEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(doc.removeEventListener).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(doc.removeEventListener).toHaveBeenCalledWith("mouseup", expect.any(Function));
    expect(geometry.lockScroll).toHaveBeenLastCalledWith(false);
  });
});
