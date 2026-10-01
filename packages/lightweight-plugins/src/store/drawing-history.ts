// Per-chart undo/redo for drawing edits. A step journals only the drawings an
// edit touched, so replaying it never clobbers background writes to others.
// Generic over the bucket shape: no runtime or type dependency on the store.
type Bucket = Record<string /* kind */, { id: number }[]>;

export type Snap = { item: { id: number }; index: number };
/** `before`/`after` null means the drawing did not exist on that side. */
export type Entry = { bucketKey: string; kind: string; id: number; before: Snap | null; after: Snap | null };
export type Step = { entries: Entry[]; mergeKey?: string };
/** `base` is the buckets as they stood when the edit opened. */
export type Journal = {
  chartKey: string;
  mergeKey?: string;
  base: Record<string, Bucket>;
  touched: Map<string, Entry>;
};

const HISTORY_LIMIT = 100;

// Neither kind nor id contains "|", so the key is unambiguous read from the right.
const entryKey = (e: { bucketKey: string; kind: string; id: number }) => `${e.bucketKey}|${e.kind}|${e.id}`;

/** The item and its index, or null when absent (or the bucket is). */
function snapOf(
  buckets: Record<string, Bucket>,
  bucketKey: string,
  kind: string,
  id: number,
): Snap | null {
  // `?? []`: a bucket persisted before this kind existed has no such key.
  const items = buckets[bucketKey]?.[kind] ?? [];
  const index = items.findIndex((it) => it.id === id);
  return index === -1 ? null : { item: items[index], index };
}

export function openJournal(chartKey: string, base: Record<string, Bucket>, mergeKey?: string): Journal {
  return { chartKey, mergeKey, base, touched: new Map() };
}

/** Records `before` the first time an edit touches (bucketKey, kind, id). */
export function touch(journal: Journal, bucketKey: string, kind: string, id: number): void {
  const key = entryKey({ bucketKey, kind, id });
  if (journal.touched.has(key)) return;
  // From the base, not the live buckets: every `before` index must count positions in the same array.
  const before = snapOf(journal.base, bucketKey, kind, id);
  journal.touched.set(key, { bucketKey, kind, id, before, after: null });
}

/** Reads each touched entry's `after`; drops null→null and unchanged-by-reference entries. */
export function closeJournal(journal: Journal, buckets: Record<string, Bucket>): Step {
  const entries: Entry[] = [];
  for (const e of journal.touched.values()) {
    const after = snapOf(buckets, e.bucketKey, e.kind, e.id);
    // Both absent (added then removed) or the same reference: nothing to replay.
    if (e.before?.item === after?.item) continue;
    entries.push({ ...e, after });
  }
  return { entries, mergeKey: journal.mergeKey };
}

// Every touched id comes out, then each side's snap goes back at its recorded
// index. Ascending, so each index counts the lower items already back in place.
function replay(items: { id: number }[], entries: Entry[], side: "before" | "after"): { id: number }[] {
  const touched = new Set(entries.map((e) => e.id));
  const out = items.filter((it) => !touched.has(it.id));
  const snaps = entries.flatMap((e) => e[side] ?? []).sort((x, y) => x.index - y.index);
  for (const snap of snaps) out.splice(Math.min(snap.index, out.length), 0, snap.item);
  return out;
}

/** Writes one side of a step: removals, then in-place replaces, then inserts by ascending index (clamped). Missing buckets are created with `emptyBucket()`. */
export function applyStep<B extends Bucket>(
  buckets: Record<string, B>,
  step: Step,
  side: "before" | "after",
  emptyBucket: () => B,
): Record<string, B> {
  // A loop, not Map.groupBy: that is ES2024 and missing before Safari 17.4.
  const groups = new Map<string, Entry[]>();
  for (const e of step.entries) {
    const key = `${e.bucketKey}|${e.kind}`;
    const group = groups.get(key);
    if (group) group.push(e);
    else groups.set(key, [e]);
  }
  const next = { ...buckets };
  for (const entries of groups.values()) {
    const { bucketKey, kind } = entries[0];
    const bucket: Bucket = { ...(next[bucketKey] ?? emptyBucket()) };
    bucket[kind] = replay(bucket[kind] ?? [], entries, side);
    // Localized cast: a B with one kind array swapped for its replayed copy.
    next[bucketKey] = bucket as B;
  }
  return next;
}

// Earliest `before` (kept from the top step), latest `after`; new ids appended.
function merge(top: Step, step: Step): Step {
  const incoming = new Map(step.entries.map((e) => [entryKey(e), e]));
  const entries = top.entries.map((e) => {
    const later = incoming.get(entryKey(e));
    if (!later) return e;
    incoming.delete(entryKey(e));
    return { ...e, after: later.after };
  });
  return { ...top, entries: [...entries, ...incoming.values()] };
}

export function createDrawingHistory() {
  const charts = new Map<string, { undo: Step[]; redo: Step[] }>();

  const stacks = (chartKey: string) => {
    let s = charts.get(chartKey);
    if (!s) {
      s = { undo: [], redo: [] };
      charts.set(chartKey, s);
    }
    return s;
  };

  return {
    /** Empty steps are ignored. Merges into the top step on an equal defined mergeKey (earliest before, latest after, new ids appended); else pushes and caps. Always clears redo. */
    push(chartKey: string, step: Step): void {
      // An edit that changed nothing (a click without a drag) must not cost the user their redo.
      if (step.entries.length === 0) return;
      const { undo, redo } = stacks(chartKey);
      redo.length = 0;
      const top = undo[undo.length - 1];
      if (top && step.mergeKey !== undefined && top.mergeKey === step.mergeKey) {
        undo[undo.length - 1] = merge(top, step);
        return;
      }
      undo.push(step);
      if (undo.length > HISTORY_LIMIT) undo.splice(0, undo.length - HISTORY_LIMIT);
    },
    /** Moves the top step of `stack` onto the other stack and returns it, or null. */
    pop(chartKey: string, stack: "undo" | "redo"): Step | null {
      const s = stacks(chartKey);
      const [from, to] = stack === "undo" ? [s.undo, s.redo] : [s.redo, s.undo];
      const step = from.pop();
      if (step) to.push(step);
      return step ?? null;
    },
    reset(): void {
      charts.clear();
    },
  };
}
