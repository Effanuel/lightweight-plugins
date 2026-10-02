// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Drawing, DrawingManager } from "../drawing-manager";
import { DrawingSettings } from "./DrawingSettings";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STYLE = { width: 1, color: "#ffffff", pattern: "solid" as const, opacity: 1 };
const BOX_STYLE = { borderColor: "#ffffff", borderWidth: 2, borderOpacity: 1, bgColor: "#2962ff", bgOpacity: 0.1 };
const P = { price: 1, time: 0 };
const trend: Drawing = { kind: "trend", id: 1, p1: P, p2: P, style: STYLE };
const box: Drawing = { kind: "box", id: 2, p1: P, p2: P, style: BOX_STYLE };
const fib: Drawing = {
  kind: "fibonacci",
  id: 3,
  p1: P,
  p2: P,
  style: STYLE,
  levels: [
    { value: 0, visible: true },
    { value: 0.5, visible: true },
    { value: 1, visible: false },
  ],
};

function fakeManager() {
  let selection: Drawing[] = [];
  let y: number | null = null;
  const listeners = new Set<() => void>();
  const manager = {
    on: (_event: string, cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSelection: () => selection,
    getSelectionY: () => y,
    setStyle: vi.fn(),
    setToolStyle: vi.fn(),
    setFibLevels: vi.fn(),
    deleteSelected: vi.fn(),
  };
  const select = (next: Drawing[], nextY: number | null = 100) =>
    act(() => {
      selection = next;
      y = nextY;
      for (const cb of [...listeners]) cb();
    });
  return { manager, select, asManager: manager as unknown as DrawingManager };
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

const render = (m: DrawingManager) => act(() => root.render(<DrawingSettings manager={m} />));
const button = (title: string) => host.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
const click = (el: Element | null) => {
  if (!el) throw new Error("element not found");
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
};
const toolbar = () => host.querySelector<HTMLElement>(".lwp-settings");

describe("DrawingSettings", () => {
  test("shows only while something is selected, anchored by the selection's y", () => {
    const f = fakeManager();
    render(f.asManager);
    expect(toolbar()).toBeNull();
    f.select([trend], 100);
    expect(toolbar()?.style.top).toBe("86px");
    expect(toolbar()?.style.left).toBe("48px");
    f.select([]);
    expect(toolbar()).toBeNull();
  });

  test("a colour restyles line and border keys and becomes each selected kind's next style", () => {
    const f = fakeManager();
    render(f.asManager);
    f.select([trend, box], null);
    click(button("Line color"));
    click(host.querySelector('button[aria-label="#f23645"]'));
    const patch = { color: "#f23645", borderColor: "#f23645" };
    expect(f.manager.setStyle).toHaveBeenCalledWith(patch);
    expect(f.manager.setToolStyle).toHaveBeenCalledWith("trend", patch);
    expect(f.manager.setToolStyle).toHaveBeenCalledWith("box", patch);
  });

  test("controls follow the selection's kinds", () => {
    const f = fakeManager();
    render(f.asManager);
    f.select([box]);
    expect(button("Fill color")).not.toBeNull();
    expect(button("Dashed")).toBeNull();
    expect(host.textContent).toContain("2px");
    f.select([trend]);
    expect(button("Fill color")).toBeNull();
    expect(button("Dashed")).not.toBeNull();
    expect(button("Levels")).toBeNull();
    f.select([fib]);
    expect(button("Levels")?.textContent).toBe("2"); // visible levels
  });

  test("pattern, width and delete call the manager; the width menu closes on pick", () => {
    const f = fakeManager();
    render(f.asManager);
    f.select([trend]);
    click(button("Dotted"));
    expect(f.manager.setStyle).toHaveBeenLastCalledWith({ pattern: "dotted" });
    click(button("Width"));
    click([...host.querySelectorAll(".lwp-width")].find((b) => b.textContent === "3px")!);
    expect(f.manager.setStyle).toHaveBeenLastCalledWith({ width: 3, borderWidth: 3 });
    expect(host.querySelector(".lwp-width")).toBeNull();
    click(button("Delete"));
    expect(f.manager.deleteSelected).toHaveBeenCalled();
  });

  test("fib levels: toggling and typing a value set the levels; an unfinished number does not", () => {
    const f = fakeManager();
    render(f.asManager);
    f.select([fib]);
    click(button("Levels"));
    click(host.querySelectorAll('button[title="Hide level"]')[0]);
    expect(f.manager.setFibLevels).toHaveBeenLastCalledWith([
      { value: 0, visible: false },
      fib.levels![1],
      fib.levels![2],
    ]);
    const input = host.querySelectorAll<HTMLInputElement>('input[aria-label="Level value"]')[1];
    const type = (text: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    f.manager.setFibLevels.mockClear();
    type("-");
    expect(f.manager.setFibLevels).not.toHaveBeenCalled();
    type("0.618");
    expect(f.manager.setFibLevels).toHaveBeenLastCalledWith([
      fib.levels![0],
      { value: 0.618, visible: true },
      fib.levels![2],
    ]);
  });

  test("an open menu closes on a mousedown outside the toolbar, and on Escape", () => {
    const f = fakeManager();
    render(f.asManager);
    f.select([trend]);
    click(button("Line color"));
    expect(host.querySelector(".lwp-palette")).not.toBeNull();
    act(() => toolbar()!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    expect(host.querySelector(".lwp-palette")).not.toBeNull();
    act(() => document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    expect(host.querySelector(".lwp-palette")).toBeNull();
    click(button("Line color"));
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(host.querySelector(".lwp-palette")).toBeNull();
  });

  test("the grip drags the toolbar, and the dragged spot sticks for the next selection", () => {
    const f = fakeManager();
    render(f.asManager);
    f.select([trend], 100);
    const grip = host.querySelector(".lwp-grip")!;
    act(() => grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 50, clientY: 90 })));
    act(() => window.dispatchEvent(new MouseEvent("mousemove", { clientX: 150, clientY: 40 })));
    act(() => window.dispatchEvent(new MouseEvent("mouseup", {})));
    expect([toolbar()!.style.left, toolbar()!.style.top]).toEqual(["148px", "36px"]);
    f.select([]);
    f.select([box], 300);
    expect([toolbar()!.style.left, toolbar()!.style.top]).toEqual(["148px", "36px"]);
  });
});
