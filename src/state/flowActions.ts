// Flowchart canvas actions
import { fromMermaidText } from '../core/measure';
import { setConfigLayout } from '../core/ops';
import { engineOf, type LayoutEngine } from '../flow/elk';
import type { LayoutOverrides } from '../core/model';
import { clusterAt, edgeKeys, nodeAt, type EdgePort, type LineShape, type Pt } from '../flow/layout';
import type { FlowDir, FlowDoc, FlowLine, FlowShape, Link, Side } from '../flow/model';
import { addEdge, addNode, addSubgraph, deleteEdge, deleteNode, flowInsertLine, renameSubgraph, reverseEdge as reverseEdgeOp, setDirection, setEdge, setNodeLabel, setNodeShape, uniqueNodeId, unwrapSubgraph } from '../flow/ops';
import { analyzeFlow } from '../flow/parser';
import { isFreeEnd } from '../flow/shapes';
import { current as S, fitAfterLayout, type FlowSelection, type Selection } from './store';

export type FlowPaletteItem = `flow:${FlowShape}` | 'subgraph';

const F = (): FlowDoc => S().flow!;
// Forget all node positions
const clearPositions = (o: LayoutOverrides) => ({ ...o, nodes: {} });

// Keep every node where it is now
const freeze = (o: LayoutOverrides, keep?: Set<string>): LayoutOverrides => {
  const L = S().flowLayout;
  if (!L) return o;
  const r = (v: number) => Math.round(v * 10) / 10;
  return withNodes(o, (n) => {
    L.nodes.forEach((q) => (n[q.id] = { x: r(q.x), y: r(q.y) }));
    if (keep) Object.keys(n).forEach((id) => !keep.has(id) && delete n[id]);
  });
};

// Drop free link ends no link uses
function pruneFree(lines: FlowLine[]): FlowLine[] {
  for (;;) {
    const doc = analyzeFlow(lines);
    const orphan = doc.nodes.find((n) => isFreeEnd(n) && !doc.edges.some((e) => e.from === n.id || e.to === n.id));
    if (!orphan) return lines;
    lines = deleteNode(doc, orphan.id);
  }
}

// Commit, keeping nodes in place
const commit = (raw: FlowLine[], opts: { select?: Selection | null; multi?: Selection[]; edit?: FlowSelection; overrides?: LayoutOverrides } = {}) => {
  const lines = pruneFree(raw);
  if (lines !== raw && opts.select?.kind === 'edge') {
    // Re-find the edge after pruning
    const before = analyzeFlow(raw).edges[opts.select.index];
    const e = before && analyzeFlow(lines).edges.find((x) => x.from === before.from && x.to === before.to && Math.abs(x.line - before.line) <= 1);
    opts = { ...opts, select: e ? { kind: 'edge', index: e.index, line: e.line } : null };
  }
  const after = analyzeFlow(lines);
  const keep = new Set(after.nodes.map((n) => n.id));
  let overrides = opts.overrides ?? S().overrides;
  if (engineOf(after) !== 'elk') overrides = freeze(overrides, keep);
  // Adaptive: structure changes re-arrange
  else if (structureOf(after) !== structureOf(F())) overrides = clearPositions(overrides);
  else if (hasPositions(overrides)) overrides = freeze(overrides, keep);
  S().commit(lines, { ...opts, overrides });
};

// Node and link ids
const structureOf = (doc: FlowDoc) => JSON.stringify([doc.nodes.map((n) => n.id), doc.edges.map((e) => [e.from, e.to])]);

type Ports = NonNullable<LayoutOverrides['ports']>;

const withPorts = (o: LayoutOverrides, fn: (ports: Ports) => void): LayoutOverrides => {
  const ports = { ...(o.ports ?? {}) };
  fn(ports);
  return { ...o, ports };
};

// Set sides on an edge key (undefined clears)
const pin = (ports: Ports, key: string | undefined, patch: EdgePort) => {
  if (!key) return;
  const prev = ports[key] ?? {};
  const next: EdgePort = { ...prev, ...patch };
  const moved = (end: 'from' | 'to') => end in patch && patch[end] !== prev[end];
  // Moved end: drop its spot and the route
  if (moved('from') && !('fromAt' in patch)) delete next.fromAt;
  if (moved('to') && !('toAt' in patch)) delete next.toAt;
  if ((moved('from') || moved('to') || 'fromAt' in patch || 'toAt' in patch) && !('route' in patch)) delete next.route;
  (Object.keys(next) as (keyof EdgePort)[]).forEach((k) => next[k] === undefined && delete next[k]);
  if (next.from || next.to || next.shape || next.points?.length) ports[key] = next;
  else delete ports[key];
};

// Key of the edge selected after a commit
const keyOf = (lines: FlowLine[], sel: Selection | null) => (sel?.kind === 'edge' ? edgeKeys(analyzeFlow(lines))[sel.index] : undefined);

const withNodes = (o: LayoutOverrides, fn: (nodes: NonNullable<LayoutOverrides['nodes']>) => void): LayoutOverrides => {
  const nodes = { ...(o.nodes ?? {}) };
  fn(nodes);
  return { ...o, nodes };
};

// Textbox -> label
const toLabel = (text: string) => text.trim().replace(/\r?\n/g, '<br/>');

// Same edge after a rewrite (the line may split)
const findEdge = (before: FlowDoc, lines: FlowLine[], line: number, from: string, to: string): Selection | null => {
  const grown = lines.length - before.lines.length;
  const e = analyzeFlow(lines).edges.find((x) => x.line >= line && x.line <= line + Math.max(0, grown) && x.from === from && x.to === to);
  return e ? { kind: 'edge', index: e.index, line: e.line } : null;
};

// Edge selection for a new line
const edgeAt = (lines: FlowLine[], line: number): Selection | null => {
  const e = analyzeFlow(lines).edges.find((x) => x.line === line);
  return e ? { kind: 'edge', index: e.index, line } : null;
};

export function flowEditText(t: FlowSelection): string {
  const f = F();
  if (t.kind === 'node') return fromMermaidText(f.nodes.find((n) => n.id === t.id)?.label ?? '');
  if (t.kind === 'edge') return fromMermaidText(f.edges[t.index]?.spec.text ?? '');
  return f.subgraphs.find((s) => s.id === t.id)?.title ?? '';
}

export function flowSetText(t: FlowSelection, text: string) {
  const f = F();
  if (t.kind === 'node') return commit(setNodeLabel(f, t.id, toLabel(text)), { select: t });
  if (t.kind === 'edge') return commit(setEdge(f, t.index, { text: toLabel(text) || undefined }), { select: t });
  const lines = renameSubgraph(f, t.id, text.replace(/\s*\n\s*/g, ' '));
  const sg = analyzeFlow(lines).subgraphs.find((s) => s.line === f.subgraphs.find((x) => x.id === t.id)?.line);
  commit(lines, { select: sg ? { kind: 'subgraph', id: sg.id } : null });
}

export function flowDelete(sel: FlowSelection) {
  const f = F();
  if (sel.kind === 'node') {
    // Drop its offset and pinned links
    const overrides = withPorts(
      withNodes(S().overrides, (n) => delete n[sel.id]),
      (p) => Object.keys(p).forEach((k) => (k.startsWith(`${sel.id}->`) || k.includes(`->${sel.id}#`)) && delete p[k]),
    );
    return commit(deleteNode(f, sel.id), { select: null, overrides });
  }
  if (sel.kind === 'edge') return commit(deleteEdge(f, sel.index), { select: null });
  commit(unwrapSubgraph(f, sel.id), { select: null });
}

// Delete several nodes and links in one step
export function flowDeleteMany(nodeIds: string[], edgeIndexes: number[]) {
  let lines = F().lines;
  // Highest index first keeps the others valid
  for (const i of [...edgeIndexes].sort((a, b) => b - a)) lines = deleteEdge(analyzeFlow(lines), i);
  for (const id of nodeIds) lines = deleteNode(analyzeFlow(lines), id);
  const gone = new Set(nodeIds);
  // Port keys are `from->to#n`
  const touches = (key: string) => {
    const [from, rest] = key.split('->');
    return gone.has(from) || gone.has(rest?.split('#')[0]);
  };
  const overrides = withPorts(
    withNodes(S().overrides, (n) => nodeIds.forEach((id) => delete n[id])),
    (p) => Object.keys(p).forEach((k) => touches(k) && delete p[k]),
  );
  commit(lines, { select: null, overrides });
}

export interface NodeCopy {
  id: string;
  shape: FlowShape;
  label: string;
  classes: string[];
  x: number;
  y: number;
  parent?: string;
}

// Paste nodes and the links between them, offset; selects the copies
export function pasteMany(nodes: NodeCopy[], edges: { from: string; to: string; link: Link }[], offset: Pt) {
  let lines = F().lines;
  const ids = new Map<string, string>();
  for (const n of nodes) {
    const doc = analyzeFlow(lines);
    const r = addNode(doc, n.shape, n.label, { classes: n.classes, subgraph: n.parent && doc.subgraphs.some((s) => s.id === n.parent) ? n.parent : undefined });
    lines = r.lines;
    ids.set(n.id, r.id);
  }
  for (const e of edges) {
    const [a, b] = [ids.get(e.from), ids.get(e.to)];
    if (a && b) lines = addEdge(analyzeFlow(lines), a, b, e.link).lines;
  }
  const fresh = new Set(ids.values());
  const overrides = withNodes(S().overrides, (pos) => nodes.forEach((n) => (pos[ids.get(n.id)!] = { x: Math.round(n.x + offset.x), y: Math.round(n.y + offset.y) })));
  const after = analyzeFlow(lines);
  const multi: Selection[] = [...[...fresh].map((id) => ({ kind: 'node' as const, id })), ...after.edges.filter((e) => fresh.has(e.from) && fresh.has(e.to)).map((e) => ({ kind: 'edge' as const, index: e.index, line: e.line }))];
  commit(lines, { multi, overrides });
}

// Move several nodes
export function moveNodes(ids: string[], dx: number, dy: number) {
  S().setOverrides(
    withNodes(freeze(S().overrides), (n) =>
      ids.forEach((id) => {
        const o = n[id];
        if (o) n[id] = { x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
      }),
    ),
  );
}

// Delete subgraph and contents
export function deleteSubgraphWithContents(id: string) {
  const f = F();
  const sg = f.subgraphs.find((s) => s.id === id);
  if (!sg) return;
  let doc = f;
  for (const n of f.nodes.filter((x) => x.parent === id)) doc = analyzeFlow(deleteNode(doc, n.id));
  const kept = doc.subgraphs.find((s) => s.id === id);
  commit(kept ? doc.lines.filter((_, i) => i < kept.line || i > kept.endLine) : doc.lines, { select: null });
}

// Add palette item
export function addFlowItem(item: FlowPaletteItem, at?: Pt) {
  const f = F();
  const L = S().flowLayout!;
  if (item === 'subgraph') {
    const { lines, id } = addSubgraph(f, 'Group');
    return commit(lines, { select: { kind: 'subgraph', id }, edit: { kind: 'subgraph', id } });
  }
  const shape = item.slice(5) as FlowShape;
  // Dropped on a node: connect from it
  const onNode = at ? nodeAt(L, at) : undefined;
  const inCluster = at && !onNode ? clusterAt(L, at) : undefined;
  // Shape only, no label
  const { lines, id } = addNode(f, shape, ' ', { from: onNode?.id, subgraph: onNode?.parent ?? inCluster?.id });
  // Dropped on empty canvas: land there
  const overrides = at && !onNode ? withNodes(S().overrides, (n) => (n[id] = { x: Math.round(at.x), y: Math.round(at.y) })) : undefined;
  commit(lines, { select: { kind: 'node', id }, overrides });
}

export function setShape(id: string, shape: FlowShape) {
  commit(setNodeShape(F(), id, shape), { select: { kind: 'node', id } });
}

// Paste a link copy between the same nodes
export function pasteEdge(from: string, to: string, link: Link) {
  const f = F();
  if (!f.nodes.some((n) => n.id === from) || !f.nodes.some((n) => n.id === to)) return;
  const { lines, line } = addEdge(f, from, to, link);
  const index = analyzeFlow(lines).edges.find((e) => e.line === line)?.index;
  commit(lines, { select: index === undefined ? null : { kind: 'edge', index, line } });
}

// Move node by an offset
export function moveNode(id: string, dx: number, dy: number) {
  S().setOverrides(
    withNodes(freeze(S().overrides), (n) => {
      const o = n[id];
      if (o) n[id] = { x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
    }),
  );
}

// Re-run Mermaid's layout
export function autoLayout() {
  S().setOverrides(clearPositions(S().overrides));
}

// Has hand-placed nodes
export const hasPositions = (o: LayoutOverrides) => Object.keys(o.nodes ?? {}).length > 0;

export function connectNodes(from: string, to: string, sides: EdgePort = {}) {
  const { lines, line } = addEdge(F(), from, to);
  const select = edgeAt(lines, line);
  commit(lines, { select, overrides: withPorts(S().overrides, (p) => pin(p, keyOf(lines, select), sides)) });
}

// Drag to empty space: new node
export function connectToNew(from: string, at: Pt, side?: Side) {
  const f = F();
  const parent = clusterAt(S().flowLayout!, at)?.id ?? f.nodes.find((n) => n.id === from)?.parent;
  const { lines, id, line } = addNode(f, 'rect', 'Step', { from, subgraph: parent });
  const overrides = withPorts(S().overrides, (p) => pin(p, keyOf(lines, edgeAt(lines, line)), { from: side }));
  commit(lines, { select: { kind: 'node', id }, edit: { kind: 'node', id }, overrides });
}

export function updateEdge(index: number, patch: Partial<Link> & { from?: string; to?: string }, sides?: EdgePort, extra?: { lines?: (l: FlowLine[]) => FlowLine[]; place?: Record<string, Pt> }) {
  const f = F();
  const e = f.edges[index];
  if (!e) return;
  let lines = setEdge(f, index, patch);
  if (extra?.lines) lines = extra.lines(lines);
  const select = findEdge(f, lines, e.line, patch.from ?? e.from, patch.to ?? e.to);
  // Carry ports to the new key
  const oldKey = edgeKeys(f)[index];
  const old = S().overrides.ports?.[oldKey] ?? {};
  const ported = withPorts(S().overrides, (p) => {
    delete p[oldKey];
    const keepFrom = patch.from === undefined || patch.from === e.from;
    const keepTo = patch.to === undefined || patch.to === e.to;
    pin(p, keyOf(lines, select), {
      from: keepFrom ? old.from : undefined,
      fromAt: keepFrom ? old.fromAt : undefined,
      to: keepTo ? old.to : undefined,
      toAt: keepTo ? old.toAt : undefined,
      route: keepFrom && keepTo ? old.route : undefined,
      ...sides,
    });
  });
  const overrides = extra?.place ? withNodes(ported, (n) => Object.assign(n, extra.place)) : ported;
  commit(lines, { select, overrides });
}

// Drop a link end on empty canvas: it stays there, unattached
export function detachEdge(index: number, end: 'from' | 'to', at: Pt) {
  const f = F();
  const e = f.edges[index];
  if (!e) return;
  const pos = { x: Math.round(at.x), y: Math.round(at.y) };
  const cur = f.nodes.find((n) => n.id === e[end]);
  // Already free: just move it
  if (cur && isFreeEnd(cur)) return S().setOverrides(withNodes(freeze(S().overrides), (n) => (n[cur.id] = pos)));
  const id = uniqueNodeId(f, 'free');
  const declare = (lines: FlowLine[]) => {
    const at = flowInsertLine(analyzeFlow(lines));
    const out = lines.slice();
    out.splice(at, 0, { raw: null, indent: '', stmt: { type: 'chain', groups: [[{ id, shape: 'text', text: '' }]], links: [] } });
    return out;
  };
  updateEdge(index, { [end]: id }, undefined, { lines: declare, place: { [id]: pos } });
}

// Edit one link's ports entry
const editPort = (index: number, fn: (ports: Ports, key: string) => void) => {
  const key = edgeKeys(F())[index];
  if (key) S().setOverrides(withPorts(S().overrides, (p) => fn(p, key)));
};

// Pin link ends to node sides
export const setEdgeSides = (index: number, sides: EdgePort) => editPort(index, (p, key) => pin(p, key, sides));

// Drop a link end on a node side
export function reconnectEdge(index: number, end: 'from' | 'to', node: string, side: Side, at?: number) {
  const e = F().edges[index];
  if (!e) return;
  const port: EdgePort = end === 'from' ? { from: side, fromAt: at } : { to: side, toAt: at };
  if (e[end] === node) return setEdgeSides(index, port);
  updateEdge(index, { [end]: node }, port);
}

// Line style (Auto: back to Mermaid's curve)
export function setEdgeShape(index: number, shape: LineShape) {
  editPort(index, (p, key) => {
    if (shape === 'auto') return void delete p[key];
    const cur = p[key] ?? {};
    p[key] = shape === 'ortho' ? { ...cur, shape, points: undefined } : { ...cur, shape, route: undefined };
    pin(p, key, {});
  });
}

// Straight / curved bend points
export function setEdgeBends(index: number, points: Pt[]) {
  const rounded = points.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) }));
  editPort(index, (p, key) => pin(p, key, { points: rounded.length ? rounded : undefined }));
}

// Drop hand-made bends
export const resetEdgeRoute = (index: number) => editPort(index, (p, key) => pin(p, key, { route: undefined, points: undefined }));

// Hand-made orthogonal route
export const setEdgeRoute = (index: number, port: EdgePort) => editPort(index, (p, key) => pin(p, key, port));

export function reverseEdge(index: number) {
  const f = F();
  const e = f.edges[index];
  if (!e) return;
  const lines = reverseEdgeOp(f, index);
  const select = findEdge(f, lines, e.line, e.to, e.from);
  // Swap pinned sides
  const oldKey = edgeKeys(f)[index];
  const old = S().overrides.ports?.[oldKey] ?? {};
  const overrides = withPorts(S().overrides, (p) => {
    delete p[oldKey];
    pin(p, keyOf(lines, select), { from: old.to, to: old.from, fromAt: old.toAt, toAt: old.fromAt, route: old.route?.slice().reverse() });
  });
  commit(lines, { select, overrides });
}

// Hierarchical (dagre) or Adaptive (ELK)
export function setLayoutEngine(engine: LayoutEngine) {
  if (engineOf(F()) === engine) return;
  fitAfterLayout();
  S().commit(setConfigLayout(F(), engine === 'elk' ? 'elk' : null), { overrides: clearPositions(S().overrides) });
}

export function setFlowDirection(dir: FlowDir) {
  if (F().dir === dir) return;
  // Positions don't survive a turn
  S().commit(setDirection(F(), dir), { overrides: clearPositions(S().overrides) });
}
