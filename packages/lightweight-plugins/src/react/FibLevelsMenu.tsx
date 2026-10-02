import { useState } from "react";
import { DEFAULT_FIB_LEVELS, type FibLevel } from "../lib/fib-levels";
import { ColorPicker } from "./ColorPicker";
import { EyeIcon, EyeOffIcon, PlusIcon, ResetIcon, XIcon } from "./icons";

type Props = {
  levels: readonly FibLevel[];
  /** The drawing's colour: what a level without its own colour is drawn in. */
  fallbackColor: string;
  onChange: (levels: FibLevel[]) => void;
};

/** Per-level show/hide, value, colour and remove, plus add and reset: terminal-orderflow's levels editor. */
export function FibLevelsMenu({ levels, fallbackColor, onChange }: Props) {
  const [colorRow, setColorRow] = useState<number | null>(null);
  // The text being typed into a value field, kept until blur so "0." or "-" can be typed.
  const [draft, setDraft] = useState<{ index: number; text: string } | null>(null);

  const patch = (index: number, p: Partial<FibLevel>) =>
    onChange(levels.map((l, i) => (i === index ? { ...l, ...p } : l)));
  const replaceAll = (next: FibLevel[]) => {
    setColorRow(null);
    setDraft(null);
    onChange(next);
  };

  return (
    <div className="lwp-panel lwp-menu lwp-levels">
      <div className="lwp-rows">
        {levels.map((lvl, i) => (
          <div key={i} className="lwp-level">
            <button
              type="button"
              title={lvl.visible ? "Hide level" : "Show level"}
              onClick={() => patch(i, { visible: !lvl.visible })}
              className="lwp-cell lwp-muted"
            >
              {lvl.visible ? (
                <EyeIcon />
              ) : (
                <span className="lwp-faded">
                  <EyeOffIcon />
                </span>
              )}
            </button>
            <input
              type="text"
              inputMode="decimal"
              aria-label="Level value"
              value={draft?.index === i ? draft.text : String(lvl.value)}
              onChange={(e) => {
                const text = e.target.value;
                setDraft({ index: i, text });
                const parsed = Number(text);
                if (text.trim() !== "" && Number.isFinite(parsed)) patch(i, { value: parsed });
              }}
              onBlur={() => setDraft(null)}
              className={`lwp-level-value lwp-mono${lvl.visible ? "" : " lwp-hidden-level"}`}
            />
            <button
              type="button"
              title="Level color"
              onClick={() => setColorRow(colorRow === i ? null : i)}
              className={`lwp-cell${colorRow === i ? " lwp-on" : ""}`}
            >
              <span className="lwp-level-swatch" style={{ backgroundColor: lvl.color ?? fallbackColor }} />
            </button>
            <button
              type="button"
              title="Remove level"
              onClick={() => replaceAll(levels.filter((_, idx) => idx !== i))}
              className="lwp-cell lwp-danger"
            >
              <XIcon />
            </button>
          </div>
        ))}
      </div>
      <div className="lwp-footer">
        <button
          type="button"
          onClick={() => onChange([...levels, { value: 0, visible: true }])}
          className="lwp-text-btn"
        >
          <PlusIcon />
          Add level
        </button>
        <button
          type="button"
          onClick={() => replaceAll(DEFAULT_FIB_LEVELS.map((l) => ({ ...l })))}
          className="lwp-text-btn"
        >
          <ResetIcon />
          Reset
        </button>
      </div>
      {colorRow != null && levels[colorRow] && (
        <ColorPicker
          color={levels[colorRow].color ?? fallbackColor}
          opacity={1}
          onColor={(color) => patch(colorRow, { color })}
        />
      )}
    </div>
  );
}
