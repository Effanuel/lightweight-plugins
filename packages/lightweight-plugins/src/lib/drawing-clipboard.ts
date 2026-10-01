import { DRAWING_KINDS, type DrawingKind, type DrawingDataMap } from "../model";

export type DrawingSelection = { [K in DrawingKind]: DrawingDataMap[K][] };

export function emptySelection(): DrawingSelection {
  return Object.fromEntries(DRAWING_KINDS.map((k) => [k, []])) as unknown as DrawingSelection;
}

/** In-memory clipboard, one per DrawingManager; stores and returns deep copies. */
export function createClipboard() {
  let clipboard: DrawingSelection | null = null;
  return {
    set(selection: DrawingSelection): void {
      clipboard = structuredClone(selection);
    },
    get(): DrawingSelection | null {
      return clipboard ? structuredClone(clipboard) : null;
    },
    has(): boolean {
      return clipboard !== null && DRAWING_KINDS.some((k) => clipboard![k].length > 0);
    },
  };
}

export type Clipboard = ReturnType<typeof createClipboard>;
