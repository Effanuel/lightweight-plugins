import {
  applyStep,
  closeJournal,
  createDrawingHistory,
  openJournal,
  touch,
  type Journal,
} from "./drawing-history";
import { DRAWING_KINDS, emptyBucket, type DrawingDataMap, type DrawingKind, type DrawingsBucket } from "../model";

// ponytail: one store per chart, so history and the bucket map use one fixed key.
const KEY = "chart";

export type DrawingStoreState = {
  bucket: DrawingsBucket;
  hidden: boolean;
  /** Bumped by every undo/redo/load that changed drawings, so selections can drop. */
  historyVersion: number;
};

export type DrawingSlice<K extends DrawingKind> = {
  items: () => DrawingDataMap[K][];
  add: (item: DrawingDataMap[K]) => void;
  update: (id: number, patch: Partial<Omit<DrawingDataMap[K], "id">>) => void;
  remove: (id: number) => void;
};

type Listener = (state: DrawingStoreState, prev: DrawingStoreState) => void;
type Touch = [kind: DrawingKind, id: number];

/**
 * A chart's drawings plus their undo history: terminal's zustand drawings
 * store without panes, surfaces or persistence. Every mutator journals what
 * it touched; with no edit open a write is its own undo step, inside one it
 * joins that step.
 */
export class DrawingStore {
  private state: DrawingStoreState = { bucket: emptyBucket(), hidden: false, historyVersion: 0 };
  private nextId = 1;
  private readonly history = createDrawingHistory();
  private openEdit: { journal: Journal; depth: number } | null = null;
  private untrackedDepth = 0;
  private readonly listeners = new Set<Listener>();

  getState(): DrawingStoreState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  generateId(): number {
    return this.nextId++;
  }

  items<K extends DrawingKind>(kind: K): DrawingDataMap[K][] {
    return this.state.bucket[kind] as DrawingDataMap[K][];
  }

  add<K extends DrawingKind>(kind: K, item: DrawingDataMap[K]): void {
    this.track([[kind, item.id]], () => this.setKind(kind, [...this.items(kind), item]));
  }

  update<K extends DrawingKind>(kind: K, id: number, patch: Partial<Omit<DrawingDataMap[K], "id">>): void {
    this.track([[kind, id]], () =>
      this.setKind(kind, this.items(kind).map((it) => (it.id === id ? { ...it, ...patch } : it))),
    );
  }

  remove(kind: DrawingKind, id: number): void {
    this.track([[kind, id]], () => this.setKind(kind, this.items(kind).filter((it) => it.id !== id)));
  }

  slice<K extends DrawingKind>(kind: K): DrawingSlice<K> {
    return {
      items: () => this.items(kind),
      add: (item) => this.add(kind, item),
      update: (id, patch) => this.update(kind, id, patch),
      remove: (id) => this.remove(kind, id),
    };
  }

  isHidden(): boolean {
    return this.state.hidden;
  }

  setHidden(hidden: boolean): void {
    if (hidden !== this.state.hidden) this.set({ hidden });
  }

  /** Removes every drawing as one undo step and unhides. */
  clearAll(): void {
    const touches = DRAWING_KINDS.flatMap((kind) => this.items(kind).map((it): Touch => [kind, it.id]));
    this.track(touches, () => this.set({ bucket: emptyBucket(), hidden: false }));
  }

  /** Runs `fn` as one undo step. Nested edits join the outermost, whose `mergeKey` wins. */
  edit(fn: () => void, mergeKey?: string): void {
    this.beginJournal(mergeKey);
    try {
      fn();
    } finally {
      this.endJournal();
    }
  }

  /** `edit` split across events, for a gesture (drag mousedown to mouseup). */
  beginEdit(): void {
    this.beginJournal();
  }

  /** Closes what `beginEdit` opened; a no-op with no edit open. */
  endEdit(): void {
    this.endJournal();
  }

  /** Writes inside `fn` are never journaled. */
  untracked(fn: () => void): void {
    this.untrackedDepth++;
    try {
      fn();
    } finally {
      this.untrackedDepth--;
    }
  }

  /** False, changing nothing, while an edit is open, while hidden, or with nothing to undo. */
  undo(): boolean {
    return this.replay("undo");
  }

  redo(): boolean {
    return this.replay("redo");
  }

  /** Replaces every drawing (not an undo step): clears history, continues ids above the highest loaded. */
  load(bucket: DrawingsBucket): void {
    const ids = DRAWING_KINDS.flatMap((kind) => (bucket[kind] as { id: number }[]).map((it) => it.id));
    this.nextId = Math.max(0, ...ids) + 1;
    this.history.reset();
    this.openEdit = null;
    this.set({ bucket, historyVersion: this.state.historyVersion + 1 });
  }

  private set(patch: Partial<DrawingStoreState>): void {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    for (const listener of [...this.listeners]) listener(this.state, prev);
  }

  private setKind<K extends DrawingKind>(kind: K, items: DrawingDataMap[K][]): void {
    this.set({ bucket: { ...this.state.bucket, [kind]: items } });
  }

  private buckets(): Record<string, DrawingsBucket> {
    return { [KEY]: this.state.bucket };
  }

  private track(touches: Touch[], write: () => void): void {
    if (this.untrackedDepth > 0) return write();
    this.beginJournal();
    try {
      for (const [kind, id] of touches) touch(this.openEdit!.journal, KEY, kind, id);
      write();
    } finally {
      this.endJournal();
    }
  }

  private beginJournal(mergeKey?: string): void {
    if (this.openEdit) {
      this.openEdit.depth++;
      return;
    }
    this.openEdit = { journal: openJournal(KEY, this.buckets(), mergeKey), depth: 1 };
  }

  private endJournal(): void {
    const open = this.openEdit;
    if (!open || --open.depth > 0) return;
    this.openEdit = null;
    this.history.push(KEY, closeJournal(open.journal, this.buckets()));
  }

  private replay(stack: "undo" | "redo"): boolean {
    if (this.openEdit || this.state.hidden) return false;
    const step = this.history.pop(KEY, stack);
    if (!step) return false;
    const next = applyStep(this.buckets(), step, stack === "undo" ? "before" : "after", emptyBucket);
    this.set({ bucket: next[KEY], historyVersion: this.state.historyVersion + 1 });
    return true;
  }
}
