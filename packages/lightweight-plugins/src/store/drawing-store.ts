import { DRAWING_KINDS, emptyBucket, type DrawingDataMap, type DrawingKind, type DrawingsBucket } from "../model";

export type DrawingStoreState = {
  bucket: DrawingsBucket;
  hidden: boolean;
  /** Bumped by every `load`, which replaces every drawing, so selections and in-progress gestures can drop. */
  loadVersion: number;
};

export type DrawingSlice<K extends DrawingKind> = {
  items: () => DrawingDataMap[K][];
  add: (item: DrawingDataMap[K]) => void;
  update: (id: number, patch: Partial<Omit<DrawingDataMap[K], "id">>) => void;
  remove: (id: number) => void;
};

type Listener = (state: DrawingStoreState, prev: DrawingStoreState) => void;

/** A chart's drawings: terminal's drawings store without panes, surfaces or persistence. */
export class DrawingStore {
  private state: DrawingStoreState = { bucket: emptyBucket(), hidden: false, loadVersion: 0 };
  private nextId = 1;
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
    this.setKind(kind, [...this.items(kind), item]);
  }

  update<K extends DrawingKind>(kind: K, id: number, patch: Partial<Omit<DrawingDataMap[K], "id">>): void {
    this.setKind(kind, this.items(kind).map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  remove(kind: DrawingKind, id: number): void {
    this.setKind(kind, this.items(kind).filter((it) => it.id !== id));
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

  /** Removes every drawing and unhides. */
  clearAll(): void {
    this.set({ bucket: emptyBucket(), hidden: false });
  }

  /** Replaces every drawing and continues ids above the highest loaded. */
  load(bucket: DrawingsBucket): void {
    const ids = DRAWING_KINDS.flatMap((kind) => (bucket[kind] as { id: number }[]).map((it) => it.id));
    this.nextId = Math.max(0, ...ids) + 1;
    this.set({ bucket, loadVersion: this.state.loadVersion + 1 });
  }

  private set(patch: Partial<DrawingStoreState>): void {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    for (const listener of [...this.listeners]) listener(this.state, prev);
  }

  private setKind<K extends DrawingKind>(kind: K, items: DrawingDataMap[K][]): void {
    this.set({ bucket: { ...this.state.bucket, [kind]: items } });
  }
}
