// Rendered in a <style> by the toolbar, so the subpath needs no CSS import. Every colour is a
// --lwp-* variable with terminal-orderflow's dark default; set the variables on any ancestor to theme it.
export const CSS = `
.lwp-settings {
  position: absolute;
  z-index: 50;
  font-size: 12px;
  line-height: 1.25;
  color: var(--lwp-fg, #fafafa);
  user-select: none;
}
.lwp-settings button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background-color 150ms, color 150ms;
}
.lwp-settings button:hover { background: var(--lwp-hover, #262626); }
.lwp-settings .lwp-on, .lwp-settings .lwp-on:hover { background: var(--lwp-active, #262626); }
.lwp-panel {
  width: fit-content;
  border: 1px solid var(--lwp-border, rgb(255 255 255 / 0.1));
  border-radius: 4px;
  background: var(--lwp-bg, rgb(23 23 23 / 0.95));
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  backdrop-filter: blur(8px);
}
.lwp-bar { display: flex; align-items: center; gap: 2px; padding: 4px 6px; }
.lwp-menu { margin-top: 4px; padding: 4px; }
.lwp-muted { color: var(--lwp-muted, #a1a1a1); }
.lwp-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.lwp-grip { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 20px; height: 28px; cursor: grab; }
.lwp-grip:active { cursor: grabbing; }
.lwp-sep { flex-shrink: 0; width: 1px; height: 20px; margin: 0 2px; background: var(--lwp-border, rgb(255 255 255 / 0.1)); }
.lwp-settings .lwp-icon { width: 28px; height: 28px; }
.lwp-settings .lwp-wide { height: 28px; gap: 4px; padding: 0 6px; }
.lwp-settings .lwp-pattern { width: 32px; height: 28px; }
.lwp-settings .lwp-danger { color: var(--lwp-muted, #a1a1a1); }
.lwp-settings .lwp-danger:hover { background: rgb(239 68 68 / 0.1); color: var(--lwp-danger, #f87171); }
.lwp-stack { display: flex; flex-direction: column; align-items: center; }
.lwp-line { width: 16px; height: 3px; margin-top: 2px; border-radius: 9999px; }
.lwp-small { font-size: 10px; }

.lwp-palette { width: 228px; padding: 10px; box-sizing: border-box; }
.lwp-row { display: flex; gap: 2px; }
.lwp-rows { display: flex; flex-direction: column; gap: 2px; }
.lwp-divider { height: 1px; margin: 8px 0; background: var(--lwp-border, rgb(255 255 255 / 0.1)); }
.lwp-settings .lwp-chip { width: 20px; height: 20px; flex-shrink: 0; border-radius: 3px; }
.lwp-settings .lwp-chip:hover { box-shadow: 0 0 0 1px var(--lwp-border, rgb(255 255 255 / 0.1)); }
.lwp-settings .lwp-chip.lwp-picked { box-shadow: 0 0 0 1px #000, 0 0 0 2px #fff; }
.lwp-label { margin-top: 12px; font-size: 11px; }
.lwp-opacity { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.lwp-slider { position: relative; flex: 1; height: 8px; border-radius: 9999px; overflow: hidden; cursor: pointer; }
.lwp-slider-fill { position: absolute; inset: 0; border-radius: 9999px; }
.lwp-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid #fff;
  border-radius: 9999px;
  background: #fff;
  transform: translateY(-50%);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
}
.lwp-settings input {
  margin: 0;
  border: 0;
  outline: none;
  font-size: 11px;
  text-align: right;
}
.lwp-pct { width: 28px; padding: 0; background: transparent; color: var(--lwp-fg, #fafafa); }

.lwp-settings .lwp-width { justify-content: flex-start; gap: 6px; padding: 2px 8px; border-radius: 2px; }

.lwp-levels { padding: 6px; }
.lwp-level { display: flex; align-items: center; gap: 4px; }
.lwp-settings .lwp-cell { width: 24px; height: 24px; border-radius: 2px; }
.lwp-settings .lwp-cell.lwp-danger:hover { background: rgb(239 68 68 / 0.1); }
.lwp-level-value {
  width: 64px;
  padding: 2px 6px;
  border-radius: 2px;
  background: var(--lwp-input, rgb(38 38 38 / 0.4));
  color: var(--lwp-fg, #fafafa);
}
.lwp-level-value.lwp-hidden-level { color: var(--lwp-muted, #a1a1a1); }
.lwp-level-swatch { width: 12px; height: 12px; border: 1px solid var(--lwp-border, rgb(255 255 255 / 0.1)); border-radius: 2px; }
.lwp-faded { opacity: 0.5; }
.lwp-footer { display: flex; align-items: center; gap: 4px; margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--lwp-border, rgb(255 255 255 / 0.1)); }
.lwp-settings .lwp-text-btn { height: 24px; gap: 4px; padding: 0 6px; border-radius: 2px; font-size: 11px; color: var(--lwp-muted, #a1a1a1); }
.lwp-settings .lwp-text-btn:hover { color: var(--lwp-fg, #fafafa); }
`;
