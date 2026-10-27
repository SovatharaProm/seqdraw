// Flowchart layout (dagre, as in Mermaid)
import dagre from '@dagrejs/dagre';
import { LINE_HEIGHT, measureText, splitLines, type Measure } from '../core/measure';
import type { FlowDoc, FlowShape, Link, Side } from './model';
import { flowShapeOf, isFreeEnd } from './shapes';

export type Pt = { x: number; y: number };

export interface FlowStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  color?: string;
}

export interface FNode {
  id: string;
  label: string[];
  shape: FlowShape;
  index: number;
  // Center
  x: number;
  y: number;
  width: number;
  height: number;
  parent?: string;
  style: FlowStyle;
}

export interface FEdge {
  index: number;
  // Stable key for overrides
  key: string;
  // Pinned sides
  fromSide?: Side;
  toSide?: Side;
  // Orthogonal route
  ortho?: boolean;
  line: number;
  from: string;
  to: string;
  spec: Link;
  points: Pt[];
  label: string[];
  labelBox?: { x: number; y: number; width: number; height: number };
  style: FlowStyle;
}

export interface FCluster {
  id: string;
  title: string[];
  line: number;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

export interface FlowLayout {
  nodes: FNode[];
  edges: FEdge[];
  clusters: FCluster[];
  title?: { text: string; x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
}

export type NodePositions = Record<string, { x: number; y: number }>;
export type EdgePorts = Record<string, { from?: Side; to?: Side }>;

const STUB = 22;
// Gap for placing new nodes
const PLACE_GAP = 50;
export const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
const NORMAL: Record<Side, Pt> = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };

type Box = { x: number; y: number; width: number; height: number };

// Side midpoint
export const portPoint = (n: Box, side: Side): Pt => ({ x: n.x + (NORMAL[side].x * n.width) / 2, y: n.y + (NORMAL[side].y * n.height) / 2 });

// Side closest to a point
export function nearestSide(n: Box, p: Pt): Side {
  let best: Side = 'top';
  let dist = Infinity;
  for (const s of SIDES) {
    const q = portPoint(n, s);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < dist) [best, dist] = [s, d];
  }
  return best;
}

// Side facing a point
function facingSide(n: Box, p: Pt): Side {
  const dx = (p.x - n.x) / Math.max(1, n.width);
  const dy = (p.y - n.y) / Math.max(1, n.height);
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top';
}

// Edge keys by edge index: from->to#n
export function edgeKeys(doc: FlowDoc): string[] {
  const seen = new Map<string, number>();
  return doc.edges.map((e) => {
    const base = `${e.from}->${e.to}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}

// Orthogonal route between two ports
export function orthoRoute(a: Pt, sa: Side, b: Pt, sb: Side): Pt[] {
  const na = NORMAL[sa];
  const nb = NORMAL[sb];
  const s1 = { x: a.x + na.x * STUB, y: a.y + na.y * STUB };
  const s2 = { x: b.x + nb.x * STUB, y: b.y + nb.y * STUB };
  const vA = na.x === 0;
  const vB = nb.x === 0;
  let mid: Pt[];
  if (vA && vB) {
    // Facing each other: split halfway
    const facing = (s2.y - s1.y) * na.y > 0 && (s1.y - s2.y) * nb.y > 0;
    const y = facing ? (s1.y + s2.y) / 2 : na.y > 0 ? Math.max(s1.y, s2.y) : Math.min(s1.y, s2.y);
    mid = [{ x: s1.x, y }, { x: s2.x, y }];
  } else if (!vA && !vB) {
    const facing = (s2.x - s1.x) * na.x > 0 && (s1.x - s2.x) * nb.x > 0;
    const x = facing ? (s1.x + s2.x) / 2 : na.x > 0 ? Math.max(s1.x, s2.x) : Math.min(s1.x, s2.x);
    mid = [{ x, y: s1.y }, { x, y: s2.y }];
  } else mid = vA ? [{ x: s1.x, y: s2.y }] : [{ x: s2.x, y: s1.y }];
  const pts = [a, s1, ...mid, s2, b];
  // Drop repeats and collinear points
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue;
    const prev = out[out.length - 2];
    if (prev && last && ((Math.abs(prev.x - last.x) < 0.5 && Math.abs(last.x - p.x) < 0.5) || (Math.abs(prev.y - last.y) < 0.5 && Math.abs(last.y - p.y) < 0.5))) out.pop();
    out.push(p);
  }
  return out;
}

// Point halfway along a polyline
function midpoint(pts: Pt[]): Pt {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let half = lens.reduce((s, l) => s + l, 0) / 2;
  for (let i = 0; i < lens.length; i++) {
    if (half <= lens[i]) {
      const t = lens[i] ? half / lens[i] : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
    }
    half -= lens[i];
  }
  return pts[0];
}

const MARGIN = 24;
const TITLE_H = 24;
const CLUSTER_PAD = 16;

// `fill:#f9f,stroke:#333`
export function parseStyle(css: string | undefined, into: FlowStyle = {}): FlowStyle {
  for (const decl of (css ?? '').split(/[,;]/)) {
    const m = decl.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'fill') into.fill = v;
    else if (k === 'stroke') into.stroke = v;
    else if (k === 'stroke-width') into.strokeWidth = parseFloat(v) || undefined;
    else if (k === 'stroke-dasharray') into.dash = v;
    else if (k === 'color') into.color = v;
  }
  return into;
}

// Label lines
export const labelLines = (text: string) => splitLines(text.replace(/^`|`$/g, '').replace(/\*\*|__/g, ''));

const BLANK_W = 64;
const blockSize = (lines: string[], measure: Measure) => ({ w: Math.max(0, ...lines.map((l) => measure(l))), h: lines.length * LINE_HEIGHT });

// Shape boundary point toward `p`
export function clip(n: { x: number; y: number; width: number; height: number; shape: FlowShape }, p: Pt): Pt {
  const dx = p.x - n.x;
  const dy = p.y - n.y;
  if (!dx && !dy) return { x: n.x, y: n.y };
  const w = n.width / 2;
  const h = n.height / 2;
  const def = flowShapeOf(n.shape);
  if (def.round) {
    const t = 1 / Math.hypot(dx / w, dy / h);
    return { x: n.x + dx * t, y: n.y + dy * t };
  }
  if (def.polygon) {
    const pts = def.polygon(n.width, n.height).map(([x, y]) => ({ x: x - w, y: y - h }));
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      // Ray (0,0)->(dx,dy) vs segment a-b
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = (a.x * ey - a.y * ex) / den;
      const u = (a.x * dy - a.y * dx) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
    }
    if (isFinite(best)) return { x: n.x + dx * best, y: n.y + dy * best };
  }
  const t = Math.min(dx ? w / Math.abs(dx) : Infinity, dy ? h / Math.abs(dy) : Infinity);
  return { x: n.x + dx * t, y: n.y + dy * t };
}

export function layoutFlow(doc: FlowDoc, positions: NodePositions, measure: Measure = measureText, ports: EdgePorts = {}): FlowLayout {
  // Ignore old offset entries
  const posOf = (id: string) => {
    const p = positions[id];
    return p && typeof p.x === 'number' && typeof p.y === 'number' ? p : undefined;
  };
  const g = new dagre.graphlib.Graph({ multigraph: true, compound: true });
  const rankdir = doc.dir === 'TD' ? 'TB' : doc.dir;
  g.setGraph({ rankdir, nodesep: 50, ranksep: 50, marginx: 8, marginy: 8 });
  g.setDefaultEdgeLabel(() => ({}));

  const sgIds = new Set(doc.subgraphs.map((s) => s.id));
  const nodeIds = new Set(doc.nodes.map((n) => n.id));
  const nodes: FNode[] = doc.nodes.map((n, index) => {
    const label = labelLines(n.label);
    // Blank shape: default size
    const t = !n.label.trim() && n.shape !== 'text' ? { w: BLANK_W, h: LINE_HEIGHT } : blockSize(label, measure);
    const { w, h } = flowShapeOf(n.shape).size(t.w, t.h);
    const style: FlowStyle = parseStyle(doc.classDefs.default);
    n.classes.forEach((c) => parseStyle(doc.classDefs[c], style));
    parseStyle(n.style, style);
    return { id: n.id, label, shape: n.shape, index, x: 0, y: 0, width: Math.round(w), height: Math.round(h), parent: n.parent, style };
  });
  for (const n of nodes) g.setNode(n.id, { width: n.width, height: n.height });

  // Subgraphs
  const children = new Map<string, string[]>();
  for (const s of doc.subgraphs) if (s.parent) children.set(s.parent, [...(children.get(s.parent) ?? []), s.id]);
  for (const n of nodes) if (n.parent && sgIds.has(n.parent)) children.set(n.parent, [...(children.get(n.parent) ?? []), n.id]);
  for (const s of doc.subgraphs) {
    const empty = !children.get(s.id)?.length;
    const t = blockSize(labelLines(s.title), measure);
    g.setNode(s.id, empty ? { width: Math.max(80, t.w + 32), height: TITLE_H + 32 } : {});
  }
  for (const s of doc.subgraphs) if (s.parent) g.setParent(s.id, s.parent);
  for (const n of nodes) if (n.parent && sgIds.has(n.parent)) g.setParent(n.id, n.parent);

  // Edge to a subgraph -> its first node
  const leaf = (id: string): string | undefined => {
    if (nodeIds.has(id) || !sgIds.has(id)) return id;
    for (const c of children.get(id) ?? []) {
      const l = leaf(c);
      if (l && nodeIds.has(l)) return l;
    }
    return children.get(id)?.length ? undefined : id;
  };

  const edges: FEdge[] = [];
  const keys = edgeKeys(doc);
  doc.edges.forEach((e) => {
    const from = leaf(e.from);
    const to = leaf(e.to);
    if (!from || !to) return;
    const label = e.spec.text && e.spec.stroke !== 'invisible' ? labelLines(e.spec.text) : [];
    const t = blockSize(label, measure);
    const name = String(e.index);
    g.setEdge(from, to, { minlen: e.spec.length, ...(label.length ? { width: t.w + 8, height: t.h + 4, labelpos: 'c' } : {}) }, name);
    const key = keys[e.index];
    edges.push({ index: e.index, key, fromSide: ports[key]?.from, toSide: ports[key]?.to, line: e.line, from, to, spec: e.spec, points: [], label, style: parseStyle(e.style) });
  });

  dagre.layout(g);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  // Shift from the auto position
  const delta = new Map<string, Pt>();
  const settled: FNode[] = [];
  for (const n of nodes) {
    const d = g.node(n.id);
    const p = posOf(n.id);
    n.x = p?.x ?? d.x;
    n.y = p?.y ?? d.y;
    if (p) {
      delta.set(n.id, { x: p.x - d.x, y: p.y - d.y });
      settled.push(n);
    }
  }
  if (settled.length) placeNew(doc, nodes, settled, delta, g);

  // Clusters
  const depthOf = (id: string): number => {
    const p = doc.subgraphs.find((s) => s.id === id)?.parent;
    return p ? depthOf(p) + 1 : 0;
  };
  const clusters: FCluster[] = doc.subgraphs.map((s) => {
    const d = g.node(s.id);
    return { id: s.id, title: labelLines(s.title), line: s.line, x: d.x - d.width / 2, y: d.y - d.height / 2, width: d.width, height: d.height, depth: depthOf(s.id) };
  });
  const clusterById = new Map(clusters.map((c) => [c.id, c]));
  const moved = (id: string): boolean => !!posOf(id) || (children.get(id) ?? []).some(moved);
  // Deepest first
  // Children box
  const kidsBox = (kids: string[]) => {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const k of kids) {
      const n = byId.get(k);
      const cc = clusterById.get(k);
      const b = n ? { x: n.x - n.width / 2, y: n.y - n.height / 2, w: n.width, h: n.height } : cc ? { x: cc.x, y: cc.y, w: cc.width, h: cc.height } : null;
      if (!b) continue;
      x1 = Math.min(x1, b.x);
      y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w);
      y2 = Math.max(y2, b.y + b.h);
    }
    return { x1, y1, x2, y2 };
  };
  for (const c of [...clusters].sort((a, b) => b.depth - a.depth)) {
    const kids = children.get(c.id) ?? [];
    if (kids.length && moved(c.id)) {
      // Fit moved children
      const { x1, y1, x2, y2 } = kidsBox(kids);
      Object.assign(c, { x: x1 - CLUSTER_PAD, y: y1 - CLUSTER_PAD, width: x2 - x1 + CLUSTER_PAD * 2, height: y2 - y1 + CLUSTER_PAD * 2 });
    }
    // Title room beyond existing padding
    if (kids.length) {
      const need = TITLE_H + 6 - (kidsBox(kids).y1 - c.y);
      if (need > 0) {
        c.y -= need;
        c.height += need;
      }
    }
    const tw = blockSize(c.title, measure).w + 24;
    if (c.width < tw) {
      c.x -= (tw - c.width) / 2;
      c.width = tw;
    }
    // Grow parent
    const parent = doc.subgraphs.find((s) => s.id === c.id)?.parent;
    const pc = parent ? clusterById.get(parent) : undefined;
    if (pc && !moved(pc.id)) {
      const x1 = Math.min(pc.x, c.x - 8);
      const y1 = Math.min(pc.y, c.y - 8);
      const x2 = Math.max(pc.x + pc.width, c.x + c.width + 8);
      const y2 = Math.max(pc.y + pc.height, c.y + c.height + 8);
      Object.assign(pc, { x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
    }
  }

  // Edge geometry
  for (const e of edges) {
    const de = g.edge(e.from, e.to, String(e.index));
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    const da = delta.get(e.from) ?? { x: 0, y: 0 };
    const db = delta.get(e.to) ?? { x: 0, y: 0 };
    const same = Math.abs(da.x - db.x) < 0.5 && Math.abs(da.y - db.y) < 0.5;
    let pts: Pt[] = (de?.points ?? []).map((p: Pt) => ({ x: p.x + da.x, y: p.y + da.y }));
    let lx = de?.x === undefined ? undefined : de.x + da.x;
    let ly = de?.y === undefined ? undefined : de.y + da.y;
    if (a && b && (!same || pts.length < 2)) {
      // Placed nodes: soft curve between facing sides
      const sa = facingSide(a, b);
      const sb = facingSide(b, a);
      const pa = portPoint(a, sa);
      const pb = portPoint(b, sb);
      const out = (p: Pt, s: Side) => ({ x: p.x + NORMAL[s].x * 30, y: p.y + NORMAL[s].y * 30 });
      pts = a === b ? pts : [{ x: a.x, y: a.y }, out(pa, sa), out(pb, sb), { x: b.x, y: b.y }];
      ({ x: lx, y: ly } = midpoint([pa, out(pa, sa), out(pb, sb), pb]));
    }
    if (a && b && (e.fromSide || e.toSide)) {
      // Pinned sides: orthogonal route
      const sa = e.fromSide ?? facingSide(a, e.toSide ? portPoint(b, e.toSide) : b);
      const sb = e.toSide ?? facingSide(b, portPoint(a, sa));
      pts = orthoRoute(portPoint(a, sa), sa, portPoint(b, sb), sb);
      e.ortho = true;
      ({ x: lx, y: ly } = midpoint(pts));
    } else if (a && b && pts.length >= 2) {
      const inner = pts.slice(1, -1);
      const start = clip(a, inner[0] ?? b);
      const end = clip(b, inner[inner.length - 1] ?? a);
      pts = [start, ...inner, end];
    }
    e.points = pts;
    if (e.label.length && lx !== undefined && ly !== undefined) {
      const t = blockSize(e.label, measure);
      e.labelBox = { x: lx - t.w / 2 - 4, y: ly! - t.h / 2 - 2, width: t.w + 8, height: t.h + 4 };
    }
  }

  // Bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x1: number, y1: number, x2: number, y2: number) => {
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  };
  nodes.forEach((n) => grow(n.x - n.width / 2, n.y - n.height / 2, n.x + n.width / 2, n.y + n.height / 2));
  clusters.forEach((c) => grow(c.x, c.y, c.x + c.width, c.y + c.height));
  edges.forEach((e) => {
    e.points.forEach((p) => grow(p.x - 6, p.y - 6, p.x + 6, p.y + 6));
    if (e.labelBox) grow(e.labelBox.x, e.labelBox.y, e.labelBox.x + e.labelBox.width, e.labelBox.y + e.labelBox.height);
  });
  if (!isFinite(minX)) [minX, minY, maxX, maxY] = [0, 0, 200, 100];
  let title: FlowLayout['title'];
  if (doc.title) {
    const tw = measure(doc.title, true) * 1.3;
    title = { text: doc.title, x: (minX + maxX) / 2, y: minY - 16 };
    grow((minX + maxX) / 2 - tw / 2, minY - 36, (minX + maxX) / 2 + tw / 2, maxY);
  }
  const bounds = { x: minX - MARGIN, y: minY - MARGIN, width: maxX - minX + MARGIN * 2, height: maxY - minY + MARGIN * 2 };
  return { nodes, edges, clusters, title, bounds };
}

const overlaps = (n: FNode, others: FNode[]) =>
  others.some((m) => m !== n && Math.abs(m.x - n.x) < (m.width + n.width) / 2 + 20 && Math.abs(m.y - n.y) < (m.height + n.height) / 2 + 20);

// Place nodes without a position next to a placed neighbour
function placeNew(doc: FlowDoc, nodes: FNode[], settled: FNode[], delta: Map<string, Pt>, g: { node(id: string): { x: number; y: number } }) {
  const flow = { TB: { x: 0, y: 1 }, TD: { x: 0, y: 1 }, BT: { x: 0, y: -1 }, LR: { x: 1, y: 0 }, RL: { x: -1, y: 0 } }[doc.dir];
  const across = { x: Math.abs(flow.y), y: Math.abs(flow.x) };
  // Average shift of placed nodes
  const anchor = { x: 0, y: 0 };
  for (const d of delta.values()) (anchor.x += d.x / delta.size), (anchor.y += d.y / delta.size);
  const done = new Set(settled.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (done.has(n.id)) continue;
    const pred = doc.edges.find((e) => e.to === n.id && done.has(e.from));
    const succ = pred ? undefined : doc.edges.find((e) => e.from === n.id && done.has(e.to));
    const ref = byId.get(pred?.from ?? succ?.to ?? '');
    if (ref) {
      const sign = pred ? 1 : -1;
      const step = (size: (q: FNode) => number) => sign * (size(ref) / 2 + PLACE_GAP + size(n) / 2);
      n.x = ref.x + flow.x * step((q) => q.width);
      n.y = ref.y + flow.y * step((q) => q.height);
    } else {
      // Unconnected: just past the end of the diagram
      const half = (m: FNode) => (across.y * m.width + across.x * m.height) / 2;
      const along = (m: FNode) => m.x * flow.x + m.y * flow.y;
      const far = Math.max(...settled.map((m) => along(m) + half(m))) + PLACE_GAP + half(n);
      const mid = (f: (m: FNode) => number) => (Math.min(...settled.map(f)) + Math.max(...settled.map(f))) / 2;
      n.x = flow.x ? far * flow.x : mid((m) => m.x);
      n.y = flow.y ? far * flow.y : mid((m) => m.y);
    }
    // Step sideways until free
    for (let i = 0; i < 40 && overlaps(n, settled); i++) {
      n.x += across.x * (n.width + 30);
      n.y += across.y * (n.height + 30);
    }
    const d = g.node(n.id);
    delta.set(n.id, { x: n.x - d.x, y: n.y - d.y });
    settled.push(n);
    done.add(n.id);
  }
}

// Node at a point
export function nodeAt(layout: FlowLayout, p: Pt, pad = 0): FNode | undefined {
  for (let i = layout.nodes.length - 1; i >= 0; i--) {
    const n = layout.nodes[i];
    // Free link ends aren't targets
    if (isFreeEnd({ shape: n.shape, label: n.label.join('') })) continue;
    if (Math.abs(p.x - n.x) <= n.width / 2 + pad && Math.abs(p.y - n.y) <= n.height / 2 + pad) return n;
  }
  return undefined;
}

// Innermost cluster at a point
export function clusterAt(layout: FlowLayout, p: Pt): FCluster | undefined {
  let best: FCluster | undefined;
  for (const c of layout.clusters) {
    if (p.x >= c.x && p.x <= c.x + c.width && p.y >= c.y && p.y <= c.y + c.height && (!best || c.depth > best.depth)) best = c;
  }
  return best;
}
