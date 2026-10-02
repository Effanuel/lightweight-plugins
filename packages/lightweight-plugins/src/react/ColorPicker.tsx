import { useRef, type MouseEvent as ReactMouseEvent } from "react";

// TradingView's palette, as in terminal-orderflow.
const GRAYS_ROW = [
  "#ffffff",
  "#dbdbdb",
  "#b8b8b8",
  "#9c9c9c",
  "#808080",
  "#636363",
  "#4a4a4a",
  "#303030",
  "#1a1a1a",
  "#000000",
];
const PRIMARY_ROW = [
  "#f23645",
  "#ff9800",
  "#ffeb3b",
  "#4caf50",
  "#089981",
  "#00bcd4",
  "#2962ff",
  "#673ab7",
  "#9c27b0",
  "#e91e63",
];
const SHADE_ROWS = [
  ["#fccbcd", "#ffe0b2", "#fff9c4", "#c8e6c9", "#ace5dc", "#b2ebf2", "#bbd9fb", "#d1c4e9", "#e1bee7", "#f8bbd0"],
  ["#faa1a4", "#ffcc80", "#fff59d", "#a5d6a7", "#70ccbd", "#80deea", "#90bff9", "#b39ddb", "#ce93d8", "#f48fb1"],
  ["#f77c80", "#ffb74d", "#fff176", "#81c784", "#42bda8", "#4dd0e1", "#5b9cf6", "#9575cd", "#ba68c8", "#f06292"],
  ["#f7525f", "#ffa726", "#ffee58", "#66bb6a", "#22ab94", "#26c6da", "#3179f5", "#7e57c2", "#ab47bc", "#ec407a"],
  ["#b22833", "#f57c00", "#fbc02d", "#388e3c", "#056656", "#0097a7", "#1848cc", "#512da8", "#7b1fa2", "#c2185b"],
  ["#801922", "#e65100", "#f57f17", "#1b5e20", "#00332a", "#006064", "#0c3299", "#311b92", "#4a148c", "#880e4f"],
];

const WIDTHS = [1, 2, 3, 4];

function ColorRow({
  colors,
  active,
  onSelect,
}: {
  colors: string[];
  active: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="lwp-row">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          onClick={() => onSelect(c)}
          className={`lwp-chip${active.toLowerCase() === c ? " lwp-picked" : ""}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function OpacitySlider({ color, pct, onChange }: { color: string; pct: number; onChange: (pct: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const update = (e: { clientX: number }) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    onChange(Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100))));
  };
  const onMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    update(e);
    const up = () => {
      window.removeEventListener("mousemove", update);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", update);
    window.addEventListener("mouseup", up);
  };
  return (
    <div
      ref={ref}
      className="lwp-slider"
      role="slider"
      aria-label="Opacity"
      aria-valuenow={pct}
      onMouseDown={onMouseDown}
    >
      <div className="lwp-slider-fill" style={{ background: `linear-gradient(90deg, transparent, ${color})` }} />
      <div className="lwp-thumb" style={{ left: `calc(${pct}% - 6px)` }} />
    </div>
  );
}

type ColorPickerProps = {
  color: string;
  opacity: number;
  onColor: (color: string) => void;
  /** Omit to hide the opacity slider: per-level fib colours use the drawing's opacity. */
  onOpacity?: (opacity: number) => void;
};

export function ColorPicker({ color, opacity, onColor, onOpacity }: ColorPickerProps) {
  const pct = Math.round(opacity * 100);
  return (
    <div className="lwp-panel lwp-menu lwp-palette">
      <ColorRow colors={GRAYS_ROW} active={color} onSelect={onColor} />
      <div style={{ marginTop: 2 }}>
        <ColorRow colors={PRIMARY_ROW} active={color} onSelect={onColor} />
      </div>
      <div className="lwp-divider" />
      <div className="lwp-rows">
        {SHADE_ROWS.map((row, i) => (
          <ColorRow key={i} colors={row} active={color} onSelect={onColor} />
        ))}
      </div>
      {onOpacity && (
        <>
          <div className="lwp-label lwp-muted">Opacity</div>
          <div className="lwp-opacity">
            <OpacitySlider color={color} pct={pct} onChange={(v) => onOpacity(v / 100)} />
            <div style={{ display: "flex", alignItems: "center" }}>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Opacity percent"
                value={pct}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) onOpacity(Math.max(0, Math.min(100, v)) / 100);
                }}
                className="lwp-pct lwp-mono"
              />
              <span className="lwp-muted" style={{ fontSize: 11 }}>
                %
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type WidthMenuProps = { width: number; color: string; opacity: number; onSelect: (width: number) => void };

export function WidthMenu({ width, color, opacity, onSelect }: WidthMenuProps) {
  return (
    <div className="lwp-panel lwp-menu">
      {WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onSelect(w)}
          className={`lwp-width${width === w ? " lwp-on" : ""}`}
        >
          <svg width="24" height="10" viewBox="0 0 24 10" aria-hidden="true">
            <line x1="0" y1="5" x2="24" y2="5" stroke={color} strokeWidth={w} strokeOpacity={opacity} />
          </svg>
          <span className={`lwp-mono lwp-small${width === w ? "" : " lwp-muted"}`}>{w}px</span>
        </button>
      ))}
    </div>
  );
}
