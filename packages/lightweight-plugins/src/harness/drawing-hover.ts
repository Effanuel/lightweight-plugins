/**
 * Hover coordinator for one manager's drawing primitives.
 *
 * Each drawing plugin reports its hover candidate on mousemove; candidates are
 * resolved once per microtask. Corner/handle hits beat body/line hits; within a
 * tier the highest id (newest drawing) wins. One arbiter per DrawingManager, so
 * two charts on a page never resolve each other's candidates.
 */
export type HoverPrecision = "corner" | "body";

export type ReportHover = (
  setHovered: (id: number | null) => void,
  id: number | null,
  precision?: HoverPrecision,
) => void;

type HoverCandidate = { id: number; precision: HoverPrecision; setHovered: (id: number | null) => void };

const PRECISION_RANK: Record<HoverPrecision, number> = { corner: 1, body: 0 };

export function createHoverArbiter(): ReportHover {
  let candidates: HoverCandidate[] = [];
  let resolveScheduled = false;

  const resolveHover = () => {
    resolveScheduled = false;
    let winnerId = -1;
    let winnerRank = -1;
    for (const c of candidates) {
      if (c.id < 0) continue;
      const rank = PRECISION_RANK[c.precision];
      if (rank > winnerRank || (rank === winnerRank && c.id > winnerId)) {
        winnerId = c.id;
        winnerRank = rank;
      }
    }
    for (const c of candidates) c.setHovered(c.id === winnerId && winnerId >= 0 ? c.id : null);
    candidates = [];
  };

  return (setHovered, id, precision = "body") => {
    candidates.push({ id: id ?? -1, precision, setHovered });
    if (!resolveScheduled) {
      resolveScheduled = true;
      queueMicrotask(resolveHover);
    }
  };
}
