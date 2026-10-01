import { describe, expect, it } from "vitest";
import type { DrawingsBucket } from "../model";
import {
  applyStep,
  closeJournal,
  createDrawingHistory,
  openJournal,
  touch,
  type Entry,
  type Snap,
  type Step,
} from "./drawing-history";

const K = "NQ:time";
const a = { id: 1 };
const b = { id: 2 };
const c = { id: 3 };
const d = { id: 4 };

const emptyBucket = () => ({ box: [] });

/** Journals a transition between two bucket states, as the store will. */
function record(
  before: Record<string, Record<string, { id: number }[]>>,
  after: Record<string, Record<string, { id: number }[]>>,
  ids: number[],
): Step {
  const j = openJournal(K, before);
  for (const id of ids) touch(j, K, "box", id);
  return closeJournal(j, after);
}

describe("touch", () => {
  it("records the item and its index as before", () => {
    const j = openJournal(K, { [K]: { box: [a, b, c] } });
    touch(j, K, "box", 2);
    const before = [...j.touched.values()][0].before;
    expect(before).toEqual({ item: b, index: 1 });
    expect(before?.item).toBe(b);
  });

  it("records a null before for a missing id, kind, or bucket", () => {
    const j = openJournal(K, { [K]: { box: [a] } });
    touch(j, K, "box", 9);
    touch(j, K, "fib", 1);
    touch(j, "ES:time", "box", 1);
    expect([...j.touched.values()].map((e) => e.before)).toEqual([null, null, null]);
  });

  it("records one entry per id, its before read from the journal's base", () => {
    const j = openJournal(K, { [K]: { box: [a, b] } });
    touch(j, K, "box", 2);
    touch(j, K, "box", 2);
    expect([...j.touched.values()]).toEqual([
      { bucketKey: K, kind: "box", id: 2, before: { item: b, index: 1 }, after: null },
    ]);
    expect([...j.touched.values()][0].before?.item).toBe(b);
  });
});

describe("closeJournal", () => {
  it("records an add as before null", () => {
    expect(record({}, { [K]: { box: [a] } }, [1]).entries).toEqual([
      { bucketKey: K, kind: "box", id: 1, before: null, after: { item: a, index: 0 } },
    ]);
  });

  it("records a remove as after null", () => {
    expect(record({ [K]: { box: [a, b] } }, { [K]: { box: [a] } }, [2]).entries).toEqual([
      { bucketKey: K, kind: "box", id: 2, before: { item: b, index: 1 }, after: null },
    ]);
  });

  it("drops an add then remove inside one journal", () => {
    expect(record({}, { [K]: { box: [] } }, [1]).entries).toEqual([]);
  });

  it("drops an update that leaves the same reference", () => {
    const buckets = { [K]: { box: [a] } };
    expect(record(buckets, { [K]: { box: [a] } }, [1]).entries).toEqual([]);
  });

  it("carries the journal's mergeKey", () => {
    const j = openJournal(K, {}, "popup:3");
    touch(j, K, "box", 1);
    expect(closeJournal(j, { [K]: { box: [a] } }).mergeKey).toBe("popup:3");
  });
});

describe("applyStep", () => {
  it("restores a cleared bucket in its original order, whatever the journal order", () => {
    const before = { [K]: { box: [a, b, c, d] } };
    const step = record(before, {}, [4, 3, 2, 1]);
    expect(applyStep({}, step, "before", emptyBucket)).toEqual(before);
    expect(applyStep(before, step, "after", emptyBucket)).toEqual({ [K]: { box: [] } });
  });

  it("restores removed items at their original indexes", () => {
    const step = record({ [K]: { box: [a, b, c, d] } }, { [K]: { box: [a, c] } }, [2, 4]);
    expect(applyStep({ [K]: { box: [a, c] } }, step, "before", emptyBucket)).toEqual({
      [K]: { box: [a, b, c, d] },
    });
  });

  it("replaces a changed item in place", () => {
    const b2 = { id: 2, moved: true };
    const step = record({ [K]: { box: [a, b, c] } }, { [K]: { box: [a, b2, c] } }, [2]);
    const undone = applyStep({ [K]: { box: [a, b2, c] } }, step, "before", emptyBucket);
    expect(undone[K].box).toEqual([a, b, c]);
    expect(undone[K].box[1]).toBe(b);
    expect(applyStep(undone, step, "after", emptyBucket)[K].box[1]).toBe(b2);
  });

  it("clamps an insert index past the end", () => {
    const step: Step = {
      entries: [{ bucketKey: K, kind: "box", id: 4, before: { item: d, index: 7 }, after: null }],
    };
    expect(applyStep({ [K]: { box: [a] } }, step, "before", emptyBucket)[K].box).toEqual([a, d]);
  });

  it("creates a missing bucket with emptyBucket", () => {
    const step: Step = {
      entries: [{ bucketKey: "ES:time", kind: "box", id: 1, before: null, after: { item: a, index: 0 } }],
    };
    const out = applyStep({}, step, "after", () => ({ box: [], fib: [] }));
    expect(out).toEqual({ "ES:time": { box: [a], fib: [] } });
  });

  it("treats a missing kind as empty", () => {
    const v = { id: 9 };
    const step: Step = {
      entries: [{ bucketKey: K, kind: "vmedian", id: 9, before: null, after: { item: v, index: 0 } }],
    };
    expect(applyStep({ [K]: { box: [a] } }, step, "after", emptyBucket)).toEqual({
      [K]: { box: [a], vmedian: [v] },
    });
  });

  it("returns new objects and never mutates its input", () => {
    const other = { box: [d] };
    const input = { [K]: { box: [a, c] }, "ES:time": other };
    // Frozen, so any write inside applyStep throws (modules run in strict mode).
    [input, input[K], input[K].box, other, other.box].forEach((o) => Object.freeze(o));
    const step = record({ [K]: { box: [a, b, c] } }, { [K]: { box: [a, c] } }, [2]);
    const out = applyStep(input, step, "before", emptyBucket);
    expect(out).not.toBe(input);
    expect(out[K]).not.toBe(input[K]);
    expect(out[K].box).toEqual([a, b, c]);
    expect(input[K].box).toEqual([a, c]);
    // A bucket the step never touched is shared, not copied.
    expect(out["ES:time"]).toBe(other);
  });

  it("accepts the store's bucket type without casts", () => {
    const empty = (): DrawingsBucket => ({
      box: [], path: [], freedraw: [], fib: [], ray: [], trend: [], hline: [], vline: [], vmedian: [],
    });
    const line = { id: 5, price: 100, time: 10, style: {} as never };
    const before: Record<string, DrawingsBucket> = { [K]: { ...empty(), hline: [line] } };
    const after: Record<string, DrawingsBucket> = {};

    const j = openJournal(K, before);
    touch(j, K, "hline", 5);
    const step = closeJournal(j, after);
    expect(step.entries[0].before).toEqual({ item: line, index: 0 });
    const restored: Record<string, DrawingsBucket> = applyStep(after, step, "before", empty);
    expect(restored).toEqual(before);
  });
});

describe("one journal over several writes", () => {
  type Items = { id: number }[];
  const without = (id: number) => (items: Items) => items.filter((it) => it.id !== id);
  const plus = (item: { id: number }) => (items: Items) => [...items, item];

  // As the store does: each write lands before the next touch, so from the
  // second write on the bucket no longer matches the one the edit opened on.
  function edit(base: Items, writes: [id: number, write: (items: Items) => Items][]) {
    const j = openJournal(K, { [K]: { box: base } });
    let items = base;
    for (const [id, write] of writes) {
      touch(j, K, "box", id);
      items = write(items);
    }
    return { step: closeJournal(j, { [K]: { box: items } }), after: { [K]: { box: items } } };
  }

  it("undoes removing every item one at a time back to the original order", () => {
    const { step, after } = edit([a, b, c], [[1, without(1)], [2, without(2)], [3, without(3)]]);
    expect(after[K].box).toEqual([]);
    expect(applyStep(after, step, "before", emptyBucket)[K].box).toEqual([a, b, c]);
  });

  it("undoes removing two items around a survivor back to the original order", () => {
    const x = { id: 9 };
    const { step, after } = edit([a, x, b], [[1, without(1)], [2, without(2)]]);
    expect(after[K].box).toEqual([x]);
    expect(applyStep(after, step, "before", emptyBucket)[K].box).toEqual([a, x, b]);
  });

  it("round-trips an add followed by removals through undo and redo exactly", () => {
    const { step, after } = edit([a, b, c], [[4, plus(d)], [1, without(1)], [3, without(3)]]);
    expect(after[K].box).toEqual([b, d]);
    const undone = applyStep(after, step, "before", emptyBucket);
    expect(undone[K].box).toEqual([a, b, c]);
    expect(applyStep(undone, step, "after", emptyBucket)).toEqual(after);
  });
});

describe("createDrawingHistory", () => {
  const snap = (id: number, v: string): Snap => {
    const item = { id, v };
    return { item, index: 0 };
  };
  const entry = (id: number, before: Snap | null, after: Snap | null): Entry => ({
    bucketKey: K, kind: "box", id, before, after,
  });
  const step = (id: number, mergeKey?: string): Step => ({
    entries: [entry(id, null, snap(id, "x"))],
    mergeKey,
  });

  it("ignores an empty step, leaving redo intact", () => {
    const h = createDrawingHistory();
    const s1 = step(1);
    h.push(K, s1);
    h.pop(K, "undo");
    h.push(K, { entries: [] });
    expect(h.pop(K, "redo")).toBe(s1);
    h.pop(K, "undo");
    expect(h.pop(K, "undo")).toBeNull();
  });

  it("clears redo on a new step", () => {
    const h = createDrawingHistory();
    h.push(K, step(1));
    h.pop(K, "undo");
    h.push(K, step(2));
    expect(h.pop(K, "redo")).toBeNull();
    expect(h.pop(K, "undo")?.entries[0].id).toBe(2);
  });

  it("merges an equal mergeKey into the top step: earliest before, latest after, new ids appended", () => {
    const h = createDrawingHistory();
    h.push(K, { entries: [entry(1, snap(1, "x"), snap(1, "y"))], mergeKey: "popup:1" });
    h.push(K, {
      entries: [entry(1, snap(1, "y"), snap(1, "z")), entry(2, null, snap(2, "w"))],
      mergeKey: "popup:1",
    });
    expect(h.pop(K, "undo")).toEqual({
      entries: [entry(1, snap(1, "x"), snap(1, "z")), entry(2, null, snap(2, "w"))],
      mergeKey: "popup:1",
    });
    expect(h.pop(K, "undo")).toBeNull();
  });

  it("merges only into the top step, not below a different top", () => {
    const h = createDrawingHistory();
    h.push(K, step(1, "popup:1"));
    h.push(K, step(2, "popup:2"));
    h.push(K, step(3, "popup:1"));
    expect([h.pop(K, "undo"), h.pop(K, "undo"), h.pop(K, "undo")].map((s) => s?.entries.map((e) => e.id))).toEqual([
      [3], [2], [1],
    ]);
    expect(h.pop(K, "undo")).toBeNull();
  });

  it("never merges an undefined mergeKey", () => {
    const h = createDrawingHistory();
    h.push(K, step(1));
    h.push(K, step(2));
    expect(h.pop(K, "undo")?.entries.map((e) => e.id)).toEqual([2]);
    expect(h.pop(K, "undo")?.entries.map((e) => e.id)).toEqual([1]);
  });

  it("drops the oldest step past the limit", () => {
    const h = createDrawingHistory();
    for (let id = 1; id <= 101; id++) h.push(K, step(id));
    const popped: number[] = [];
    for (let s = h.pop(K, "undo"); s; s = h.pop(K, "undo")) popped.push(s.entries[0].id);
    expect(popped).toEqual(Array.from({ length: 100 }, (_, i) => 101 - i));
  });

  it("moves steps between the undo and redo stacks", () => {
    const h = createDrawingHistory();
    const s1 = step(1);
    const s2 = step(2);
    h.push(K, s1);
    h.push(K, s2);
    expect(h.pop(K, "undo")).toBe(s2);
    expect(h.pop(K, "undo")).toBe(s1);
    expect(h.pop(K, "undo")).toBeNull();
    expect(h.pop(K, "redo")).toBe(s1);
    expect(h.pop(K, "redo")).toBe(s2);
    expect(h.pop(K, "redo")).toBeNull();
    expect(h.pop(K, "undo")).toBe(s2);
  });

  it("keeps each chart's stacks independent", () => {
    const h = createDrawingHistory();
    const nq = step(1);
    const es = step(2);
    h.push(K, nq);
    h.push("ES:time", es);
    expect(h.pop("ES:time", "undo")).toBe(es);
    expect(h.pop("ES:time", "undo")).toBeNull();
    expect(h.pop(K, "redo")).toBeNull();
    expect(h.pop(K, "undo")).toBe(nq);
    expect(h.pop("ES:time", "redo")).toBe(es);
  });

  it("reset clears every chart", () => {
    const h = createDrawingHistory();
    h.push(K, step(1));
    h.push("ES:time", step(2));
    h.pop("ES:time", "undo");
    h.reset();
    expect(h.pop(K, "undo")).toBeNull();
    expect(h.pop("ES:time", "redo")).toBeNull();
  });
});
