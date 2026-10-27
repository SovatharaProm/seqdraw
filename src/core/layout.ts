import { LINE_HEIGHT, measureText, splitLines, type Measure } from './measure';
import { ARROW_SPECS, type ArrowSpec, type BlockKind, type Doc, type LayoutOverrides, type ParticipantKind } from './model';
import { shapeOf } from './participants';

const MIN_BOX_WIDTH = 110;
const BOX_PAD = 16;
const MIN_GAP = 40; // min gap between boxes
const SELF_W = 40;
const ACT_W = 10;
const MARGIN = 24;
const MIN_LIFELINE = 20;

export interface LParticipant {
  id: string;
  label: string;
  kind: ParticipantKind;
  index: number;
  x: number; // center
  width: number;
  height: number;
  top: number;
  bottom: number; // bottom box y
}

export interface LMessage {
  line: number;
  from: string;
  to: string;
  spec: ArrowSpec;
  x1: number;
  x2: number;
  y: number;
  self: boolean;
  text: string[];
  textY: number; // label top
  number?: number;
}

export interface LNote {
  line: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string[];
}

export interface LFrame {
  line: number;
  endLine: number;
  kind: BlockKind;
  label: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  sections: { line: number; y: number; label: string }[];
}

export interface LActivation {
  actor: string;
  x: number;
  y1: number;
  y2: number;
}

// Statement slot
export interface LSlot {
  line: number;
  y1: number;
  y2: number;
}

export interface Layout {
  participants: LParticipant[];
  messages: LMessage[];
  notes: LNote[];
  frames: LFrame[];
  activations: LActivation[];
  slots: LSlot[];
  title?: { text: string; x: number; y: number };
  lifelineTop: number;
  lifelineBottom: number;
  bounds: { x: number; y: number; width: number; height: number };
}

const textBlockWidth = (lines: string[], measure: Measure) => Math.max(0, ...lines.map((l) => measure(l)));

export function layoutDiagram(doc: Doc, overrides: LayoutOverrides, measure: Measure = measureText): Layout {
  const ps = doc.participants;
  const idx = new Map(ps.map((p, i) => [p.id, i]));

  // Axis X: widths and spacing
  const widths = ps.map((p) => overrides.participants[p.id]?.width ?? Math.max(MIN_BOX_WIDTH, measure(p.label, true) + BOX_PAD * 2));
  const heights = ps.map((p) => overrides.participants[p.id]?.height ?? shapeOf(p.kind).height);
  const minDist = ps.map((_, i) => (i === 0 ? 0 : widths[i - 1] / 2 + widths[i] / 2 + MIN_GAP));
  const dist = minDist.slice();

  const requireSpan = (a: number, b: number, need: number) => {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    if (lo === hi) return;
    let have = 0;
    for (let k = lo + 1; k <= hi; k++) have += dist[k];
    if (have < need) dist[hi] += need - have;
  };
  // Edge content
  const requireRight = (i: number, need: number) => i + 1 < ps.length && requireSpan(i, i + 1, need);
  const requireLeft = (i: number, need: number) => i > 0 && requireSpan(i - 1, i, need);

  for (const { stmt: s } of doc.lines) {
    if (s.type === 'message') {
      const w = textBlockWidth(splitLines(s.text), measure);
      const a = idx.get(s.from)!;
      const b = idx.get(s.to)!;
      if (a === b) requireRight(a, Math.max(w + 20, SELF_W + 20));
      else requireSpan(a, b, w + 40);
    } else if (s.type === 'note') {
      const w = noteWidth(splitLines(s.text), measure);
      const a = idx.get(s.actors[0])!;
      if (s.placement === 'right of') requireRight(a, w + 20);
      else if (s.placement === 'left of') requireLeft(a, w + 20);
      else if (s.actors.length > 1) requireSpan(a, idx.get(s.actors[s.actors.length - 1])!, w - 40);
    }
  }
  // Apply user spacing
  ps.forEach((p, i) => {
    const gap = overrides.participants[p.id]?.gap;
    if (i > 0 && gap !== undefined) dist[i] = Math.max(minDist[i], gap);
  });

  const centers: number[] = [];
  ps.forEach((_, i) => centers.push(i === 0 ? widths[0] / 2 : centers[i - 1] + dist[i]));
  // Dragged participants keep their spot
  ps.forEach((p, i) => {
    const x = overrides.participants[p.id]?.x;
    if (x !== undefined) centers[i] = x;
  });
  const center = (id: string) => centers[idx.get(id)!];

  // Axis Y: statements
  const titleH = doc.title ? 40 : 0;
  const top = titleH;
  const headerH = Math.max(0, ...heights);
  let y = top + headerH + 24;

  const messages: LMessage[] = [];
  const notes: LNote[] = [];
  const frames: LFrame[] = [];
  const activations: LActivation[] = [];
  const slots: LSlot[] = [];
  const active = new Map<string, number[]>(); // actor -> start y stack
  type Open = LFrame & { minX: number; maxX: number };
  const open: Open[] = [];
  let numbering: { n: number; step: number } | null = null;
  let lastArrowY: number | null = null;

  const extend = (x1: number, x2: number) => open.forEach((f) => ((f.minX = Math.min(f.minX, x1)), (f.maxX = Math.max(f.maxX, x2))));
  const depth = (id: string) => active.get(id)?.length ?? 0;
  const edge = (id: string, towardRight: boolean) => {
    const d = depth(id);
    if (!d) return center(id);
    const barCenter = center(id) + (d - 1) * (ACT_W / 2);
    return barCenter + (towardRight ? ACT_W / 2 : -ACT_W / 2);
  };
  const activate = (id: string, at: number) => {
    if (!active.has(id)) active.set(id, []);
    active.get(id)!.push(at);
  };
  const deactivate = (id: string, at: number) => {
    const stack = active.get(id);
    if (!stack?.length) return;
    const d = stack.length;
    const y1 = stack.pop()!;
    activations.push({ actor: id, x: center(id) + (d - 1) * (ACT_W / 2), y1, y2: at });
  };
  const closeFrame = (f: Open, endLine: number) => {
    const y1 = f.y1;
    const y2 = Math.max(y, y1 + 50);
    let { minX, maxX } = f;
    if (minX === Infinity) [minX, maxX] = [centers[0] ?? 0, centers[centers.length - 1] ?? 0];
    const labelW = measure(`${f.kind} ${f.label}`) + 40;
    const x1 = minX - 24;
    const x2 = Math.max(maxX + 24, x1 + labelW);
    frames.push({ line: f.line, endLine, kind: f.kind, label: f.label, x1, x2, y1, y2, sections: f.sections });
    y = y2 + 14;
    extend(x1, x2);
  };

  doc.lines.forEach(({ stmt: s }, line) => {
    const y0 = y;
    switch (s.type) {
      case 'autonumber':
        numbering = s.off ? null : { n: s.start ?? 1, step: s.step ?? 1 };
        return;
      case 'message': {
        const text = splitLines(s.text);
        const textY = y;
        y += text.length * LINE_HEIGHT + 6;
        const self = s.from === s.to;
        if (s.activation === '+') activate(s.to, y);
        const right = center(s.to) >= center(s.from);
        const x1 = self ? edge(s.from, true) : edge(s.from, right);
        const x2 = self ? edge(s.to, true) : edge(s.to, !right);
        messages.push({
          line, from: s.from, to: s.to, spec: ARROW_SPECS[s.arrow], x1, x2, y, self, text, textY,
          number: numbering ? numbering.n : undefined,
        });
        if (numbering) numbering.n += numbering.step;
        lastArrowY = y;
        if (s.activation === '-') deactivate(s.from, y + (self ? 28 : 0));
        extend(Math.min(x1, x2), Math.max(x1, x2) + (self ? SELF_W : 0));
        y += self ? 28 + 22 : 22;
        break;
      }
      case 'note': {
        const text = splitLines(s.text);
        const height = text.length * LINE_HEIGHT + 20;
        let width = noteWidth(text, measure);
        const a = center(s.actors[0]);
        let x: number;
        if (s.placement === 'right of') x = a + 12;
        else if (s.placement === 'left of') x = a - 12 - width;
        else if (s.actors.length > 1) {
          const b = center(s.actors[s.actors.length - 1]);
          const [lo, hi] = a < b ? [a, b] : [b, a];
          width = Math.max(width, hi - lo + 50);
          x = (lo + hi) / 2 - width / 2;
        } else x = a - width / 2;
        notes.push({ line, x, y, width, height, text });
        extend(x, x + width);
        y += height + 14;
        break;
      }
      case 'activate':
        activate(s.actor, lastArrowY ?? y);
        break;
      case 'deactivate':
        deactivate(s.actor, lastArrowY ?? y);
        break;
      case 'block':
        open.push({ line, endLine: -1, kind: s.kind, label: s.label, x1: 0, x2: 0, y1: y, y2: 0, sections: [], minX: Infinity, maxX: -Infinity });
        y += 34;
        break;
      case 'branch': {
        const f = open[open.length - 1];
        if (f) {
          f.sections.push({ line, y: y + 4, label: s.label });
          y += 30;
        }
        break;
      }
      case 'end': {
        const f = open.pop();
        if (f) closeFrame(f, line);
        break;
      }
      default:
        return;
    }
    slots.push({ line, y1: y0, y2: y });
  });
  while (open.length) closeFrame(open.pop()!, -1);

  const lifelineBottom = y + 10;
  for (const [id, stack] of active) while (stack.length) deactivate(id, lifelineBottom - 10);

  const participants: LParticipant[] = ps.map((p, i) => {
    const o = overrides.participants[p.id];
    const bottom = participantBottom(lifelineBottom + (o?.stretch ?? 0), heights[i], o?.y ?? top);
    return {
      id: p.id, label: p.label, kind: p.kind, index: i,
      x: centers[i], width: widths[i], height: heights[i], top: participantTop(bottom, heights[i], o?.y ?? top), bottom,
    };
  });

  // Bounds
  let minX = Infinity, maxX = -Infinity;
  const grow = (a: number, b: number) => ((minX = Math.min(minX, a)), (maxX = Math.max(maxX, b)));
  participants.forEach((p) => grow(p.x - p.width / 2, p.x + p.width / 2));
  frames.forEach((f) => grow(f.x1, f.x2));
  notes.forEach((n) => grow(n.x, n.x + n.width));
  messages.forEach((m) => {
    grow(Math.min(m.x1, m.x2) - 10, Math.max(m.x1, m.x2) + (m.self ? SELF_W + 10 : 10));
    // Label extent
    const mid = m.self ? m.x1 + SELF_W / 2 : (m.x1 + m.x2) / 2;
    const half = textBlockWidth(m.text, measure) / 2 + 10;
    grow(mid - half, mid + half);
  });
  if (!isFinite(minX)) [minX, maxX] = [0, 200];
  const minY = Math.min(0, ...participants.map((p) => p.top));
  const maxY = Math.max(lifelineBottom, ...participants.map((p) => p.bottom + p.height));
  const bounds = { x: minX - MARGIN, y: minY - MARGIN, width: maxX - minX + MARGIN * 2, height: maxY - minY + MARGIN * 2 };
  const title = doc.title ? { text: doc.title, x: (minX + maxX) / 2, y: 20 } : undefined;

  const out = { participants, messages, notes, frames, activations, slots, title, lifelineTop: top + headerH, lifelineBottom, bounds };
  return overrides.origin ? shiftLayout(out, overrides.origin.x, overrides.origin.y) : out;
}

// Move the whole layout
export function shiftLayout(L: Layout, dx: number, dy: number): Layout {
  if (!dx && !dy) return L;
  return {
    participants: L.participants.map((p) => ({ ...p, x: p.x + dx, top: p.top + dy, bottom: p.bottom + dy })),
    messages: L.messages.map((m) => ({ ...m, x1: m.x1 + dx, x2: m.x2 + dx, y: m.y + dy, textY: m.textY + dy })),
    notes: L.notes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })),
    frames: L.frames.map((f) => ({ ...f, x1: f.x1 + dx, x2: f.x2 + dx, y1: f.y1 + dy, y2: f.y2 + dy, sections: f.sections.map((q) => ({ ...q, y: q.y + dy })) })),
    activations: L.activations.map((a) => ({ ...a, x: a.x + dx, y1: a.y1 + dy, y2: a.y2 + dy })),
    slots: L.slots.map((q) => ({ ...q, y1: q.y1 + dy, y2: q.y2 + dy })),
    title: L.title && { ...L.title, x: L.title.x + dx, y: L.title.y + dy },
    lifelineTop: L.lifelineTop + dy,
    lifelineBottom: L.lifelineBottom + dy,
    bounds: { ...L.bounds, x: L.bounds.x + dx, y: L.bounds.y + dy },
  };
}

// Footer top (kept below the header)
export function participantBottom(bottom: number, height: number, top: number): number {
  return Math.max(bottom, top + height + MIN_LIFELINE);
}

// Header top (kept above the footer)
export function participantTop(lifelineBottom: number, height: number, top: number): number {
  return Math.min(top, lifelineBottom - height - 10);
}

function noteWidth(lines: string[], measure: Measure) {
  return Math.max(120, textBlockWidth(lines, measure) + 36);
}

// Drop line
export function dropLine(layout: Layout, y: number, fallback: number): number {
  for (const s of layout.slots) if ((s.y1 + s.y2) / 2 > y) return s.line;
  return fallback;
}

// Nearest participant
export function nearestParticipant(layout: Layout, x: number): LParticipant | undefined {
  let best: LParticipant | undefined;
  for (const p of layout.participants) if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
  return best;
}
