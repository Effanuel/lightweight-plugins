import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Drawing, DrawingManager } from "../drawing-manager";
import type { DrawingPattern, DrawingStyle } from "../lib/drawing-style";
import { DEFAULT_FIB_LEVELS } from "../lib/fib-levels";
import type { BoxStyle } from "../model";
import { ColorPicker, WidthMenu } from "./ColorPicker";
import { FibLevelsMenu } from "./FibLevelsMenu";
import { GripIcon, LevelsIcon, PaintBucketIcon, PencilIcon, TrashIcon } from "./icons";
import { CSS } from "./styles";

type Point = { x: number; y: number };
type Menu = "color" | "fill" | "width" | "levels";
type BoxDrawing = Extract<Drawing, { kind: "box" }>;
type LineDrawing = Exclude<Drawing, { kind: "box" }>;
type FibDrawing = Extract<Drawing, { kind: "fibonacci" }>;

const PATTERNS: { value: DrawingPattern; dash: string }[] = [
  { value: "solid", dash: "6 0" },
  { value: "dashed", dash: "8 4" },
  { value: "dotted", dash: "1.5 2" },
];

export type DrawingSettingsProps = { manager: DrawingManager };

/**
 * Floating style toolbar for the selected drawings, as in terminal-orderflow: line colour and
 * opacity, fill (boxes), width, line pattern, fib levels, delete. Renders nothing while nothing
 * is selected. Absolutely positioned against the nearest `position: relative` ancestor, which
 * should have the chart element at its top-left; drag it by the grip. Theme with --lwp-* variables.
 */
export function DrawingSettings({ manager }: DrawingSettingsProps) {
  const [selection, setSelection] = useState<Drawing[]>([]);
  const [anchorY, setAnchorY] = useState<number | null>(null);
  // Where the user dragged the toolbar to; kept for later selections.
  const [dragged, setDragged] = useState<Point | null>(null);

  useEffect(() => {
    const sync = () => {
      setSelection(manager.getSelection());
      setAnchorY(manager.getSelectionY());
    };
    sync();
    const offs = [manager.on("selectionChange", sync), manager.on("change", sync)];
    return () => offs.forEach((off) => off());
  }, [manager]);

  if (selection.length === 0) return null;
  const pos = dragged ?? { x: 48, y: anchorY == null ? 8 : Math.max(8, anchorY - 14) };
  return <Toolbar manager={manager} selection={selection} pos={pos} onDrag={setDragged} />;
}

type ToolbarProps = { manager: DrawingManager; selection: Drawing[]; pos: Point; onDrag: (pos: Point) => void };

/** `p` moved so the bar stays inside its positioned parent (the chart's wrapper). */
function clampToParent(root: HTMLElement | null, bar: HTMLElement | null, p: Point): Point {
  const parent = root?.offsetParent;
  if (!bar || !(parent instanceof HTMLElement)) return p;
  return {
    x: Math.max(0, Math.min(p.x, parent.clientWidth - bar.offsetWidth)),
    y: Math.max(0, Math.min(p.y, parent.clientHeight - bar.offsetHeight)),
  };
}

function Toolbar({ manager, selection, pos, onDrag }: ToolbarProps) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const toggle = (m: Menu) => setMenu((open) => (open === m ? null : m));

  // A spot dragged to on a wider chart, or a selection near the bottom, would leave the bar
  // outside the chart: pull it back in before paint. Writes the style React set from `pos`.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const p = clampToParent(el, barRef.current, pos);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
  });

  // An open menu closes on Escape or a mousedown outside the toolbar.
  useEffect(() => {
    if (!menu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  const onGripMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    // From where the bar is drawn, which the layout effect may have clamped short of `pos`.
    const shown = clampToParent(ref.current, barRef.current, pos);
    const offset = { x: e.clientX - shown.x, y: e.clientY - shown.y };
    const move = (ev: MouseEvent) =>
      onDrag(clampToParent(ref.current, barRef.current, { x: ev.clientX - offset.x, y: ev.clientY - offset.y }));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const restyle = (patch: Partial<DrawingStyle & BoxStyle>) => {
    manager.setStyle(patch);
    // As in terminal: a restyle is also what the next drawing of each selected kind gets.
    for (const kind of new Set(selection.map((d) => d.kind))) manager.setToolStyle(kind, patch);
  };

  const line = selection.find((d): d is LineDrawing => d.kind !== "box")?.style;
  const box = selection.find((d): d is BoxDrawing => d.kind === "box")?.style;
  const fib = selection.find((d): d is FibDrawing => d.kind === "fibonacci");
  // A line's stroke, else the box border: the colour and width buttons restyle both.
  const stroke = line
    ? { color: line.color, opacity: line.opacity, width: line.width }
    : { color: box!.borderColor, opacity: box!.borderOpacity, width: box!.borderWidth };

  return (
    <div ref={ref} className="lwp-settings" style={{ left: pos.x, top: pos.y }}>
      <style>{CSS}</style>
      <div ref={barRef} className="lwp-panel lwp-bar" role="toolbar" aria-label="Drawing settings">
        <div className="lwp-grip lwp-muted" title="Drag" onMouseDown={onGripMouseDown}>
          <GripIcon />
        </div>
        <div className="lwp-sep" />
        <button
          type="button"
          title="Line color"
          onClick={() => toggle("color")}
          className={`lwp-icon${menu === "color" ? " lwp-on" : ""}`}
        >
          <span className="lwp-stack">
            <span className="lwp-muted" style={{ display: "flex" }}>
              <PencilIcon />
            </span>
            <span className="lwp-line" style={{ backgroundColor: stroke.color, opacity: stroke.opacity }} />
          </span>
        </button>
        {box && (
          <button
            type="button"
            title="Fill color"
            onClick={() => toggle("fill")}
            className={`lwp-icon${menu === "fill" ? " lwp-on" : ""}`}
          >
            <span className="lwp-stack">
              <span className="lwp-muted" style={{ display: "flex" }}>
                <PaintBucketIcon />
              </span>
              <span className="lwp-line" style={{ backgroundColor: box.bgColor, opacity: box.bgOpacity }} />
            </span>
          </button>
        )}
        <button
          type="button"
          title="Width"
          onClick={() => toggle("width")}
          className={`lwp-wide${menu === "width" ? " lwp-on" : ""}`}
        >
          <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
            <line x1="0" y1="5" x2="18" y2="5" stroke="currentColor" strokeWidth={stroke.width} />
          </svg>
          <span className="lwp-small lwp-muted">{stroke.width}px</span>
        </button>
        {line && (
          <>
            <div className="lwp-sep" />
            {PATTERNS.map(({ value, dash }) => (
              <button
                key={value}
                type="button"
                title={value[0].toUpperCase() + value.slice(1)}
                aria-pressed={line.pattern === value}
                onClick={() => restyle({ pattern: value })}
                className={`lwp-pattern${line.pattern === value ? " lwp-on" : " lwp-muted"}`}
              >
                <svg width="20" height="2" viewBox="0 0 20 2" aria-hidden="true">
                  <line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray={dash} />
                </svg>
              </button>
            ))}
          </>
        )}
        {fib && (
          <>
            <div className="lwp-sep" />
            <button
              type="button"
              title="Levels"
              onClick={() => toggle("levels")}
              className={`lwp-wide${menu === "levels" ? " lwp-on" : ""}`}
            >
              <span className="lwp-muted" style={{ display: "flex" }}>
                <LevelsIcon />
              </span>
              <span className="lwp-small lwp-muted">
                {(fib.levels ?? DEFAULT_FIB_LEVELS).filter((l) => l.visible).length}
              </span>
            </button>
          </>
        )}
        <div className="lwp-sep" />
        <button type="button" title="Delete" onClick={() => manager.deleteSelected()} className="lwp-icon lwp-danger">
          <TrashIcon />
        </button>
      </div>

      {menu === "color" && (
        <ColorPicker
          color={stroke.color}
          opacity={stroke.opacity}
          onColor={(c) => restyle({ color: c, borderColor: c })}
          onOpacity={(o) => restyle({ opacity: o, borderOpacity: o })}
        />
      )}
      {menu === "fill" && box && (
        <ColorPicker
          color={box.bgColor}
          opacity={box.bgOpacity}
          onColor={(c) => restyle({ bgColor: c })}
          onOpacity={(o) => restyle({ bgOpacity: o })}
        />
      )}
      {menu === "width" && (
        <WidthMenu
          width={stroke.width}
          color={stroke.color}
          opacity={stroke.opacity}
          onSelect={(w) => {
            restyle({ width: w, borderWidth: w });
            setMenu(null);
          }}
        />
      )}
      {menu === "levels" && fib && (
        <FibLevelsMenu
          levels={fib.levels ?? DEFAULT_FIB_LEVELS}
          fallbackColor={fib.style.color}
          onChange={(levels) => manager.setFibLevels(levels)}
        />
      )}
    </div>
  );
}
