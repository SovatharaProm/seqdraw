// Box selection and select all
import { findBlockEnd } from '../core/ops';
import { isFreeEnd } from '../flow/shapes';
import { useStore, type Selection } from '../state/store';
import type { Pt } from './types';

export type Rect = { x1: number; y1: number; x2: number; y2: number };

export const rectOf = (a: Pt, b: Pt): Rect => ({ x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) });

const inside = (r: Rect, x1: number, y1: number, x2: number, y2: number) => x1 >= r.x1 && x2 <= r.x2 && y1 >= r.y1 && y2 <= r.y2;

const EVERYTHING: Rect = { x1: -Infinity, y1: -Infinity, x2: Infinity, y2: Infinity };

// Items fully inside the box
export function itemsInRect(r: Rect): Selection[] {
  const s = useStore.getState();
  const out: Selection[] = [];
  if (s.flowLayout && s.flow) {
    const picked = new Set<string>();
    for (const n of s.flowLayout.nodes) {
      const doc = s.flow.nodes.find((q) => q.id === n.id);
      if (doc && isFreeEnd(doc)) continue;
      if (inside(r, n.x - n.width / 2, n.y - n.height / 2, n.x + n.width / 2, n.y + n.height / 2)) {
        picked.add(n.id);
        out.push({ kind: 'node', id: n.id });
      }
    }
    // Links between picked nodes, or drawn inside the box
    for (const e of s.flowLayout.edges) {
      const both = picked.has(e.from) && picked.has(e.to);
      const drawn = e.points.length > 0 && e.points.every((p) => inside(r, p.x, p.y, p.x, p.y));
      if (both || drawn) out.push({ kind: 'edge', index: e.index, line: e.line });
    }
    return out;
  }
  const L = s.layout;
  for (const p of L.participants) if (inside(r, p.x - p.width / 2, p.top, p.x + p.width / 2, p.top + p.height)) out.push({ kind: 'participant', id: p.id });
  // Blocks take their contents along
  const covered = new Set<number>();
  for (const f of [...L.frames].sort((a, b) => a.line - b.line)) {
    if (!inside(r, f.x1, f.y1, f.x2, f.y2)) continue;
    const end = findBlockEnd(s.doc.lines, f.line);
    if (covered.has(f.line)) continue;
    for (let i = f.line; i <= end; i++) covered.add(i);
    out.push({ kind: 'frame', line: f.line });
  }
  for (const m of L.messages) if (!covered.has(m.line) && inside(r, Math.min(m.x1, m.x2), m.y - 1, Math.max(m.x1, m.x2), m.y + 1)) out.push({ kind: 'message', line: m.line });
  for (const n of L.notes) if (!covered.has(n.line) && inside(r, n.x, n.y, n.x + n.width, n.y + n.height)) out.push({ kind: 'note', line: n.line });
  return out;
}

export const allItems = (): Selection[] => itemsInRect(EVERYTHING);
