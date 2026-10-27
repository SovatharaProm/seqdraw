// Copy / cut / paste / duplicate for one or more selected items
import type { ParticipantKind, Statement } from '../core/model';
import { addParticipant, contentEnd, deleteParticipant, findBlockEnd, insertStatements, removeLines } from '../core/ops';
import { analyze } from '../core/parser';
import { formatStatement } from '../core/serializer';
import type { Link } from '../flow/model';
import { formatFlowStatement } from '../flow/serializer';
import * as actions from './actions';
import * as flowActions from './flowActions';
import { current as S, type Selection } from './store';
import { toast } from './toast';

type Clip =
  | { kind: 'flow'; nodes: flowActions.NodeCopy[]; edges: { from: string; to: string; link: Link }[] }
  | { kind: 'seq'; participants: { shape: ParticipantKind; label: string }[]; stmts: Statement[]; end: number };

// Offset for repeated pastes
const STEP = 32;
let clip: Clip | null = null;
let pastes = 0;

// Current selection as a list
export const selectedItems = (): Selection[] => {
  const s = S();
  return s.multi.length ? s.multi : s.selection ? [s.selection] : [];
};

// Last line a statement item covers
const endOf = (sel: Selection & { line: number }) => (sel.kind === 'frame' ? findBlockEnd(S().doc.lines, sel.line) : sel.line);

// Items -> clipboard entry
function take(items: Selection[]): Clip | null {
  const s = S();
  if (s.flow) {
    const nodes: flowActions.NodeCopy[] = [];
    for (const it of items) {
      if (it.kind !== 'node') continue;
      const n = s.flow.nodes.find((q) => q.id === it.id);
      const at = s.flowLayout?.nodes.find((q) => q.id === it.id);
      if (n && at) nodes.push({ id: n.id, shape: n.shape, label: n.label, classes: n.classes, x: at.x, y: at.y, parent: n.parent });
    }
    const edges = items.flatMap((it) => (it.kind === 'edge' && s.flow!.edges[it.index] ? [s.flow!.edges[it.index]] : [])).map((e) => ({ from: e.from, to: e.to, link: e.spec }));
    return nodes.length || edges.length ? { kind: 'flow', nodes, edges } : null;
  }
  const participants = items.flatMap((it) => {
    const p = it.kind === 'participant' ? s.doc.participants.find((q) => q.id === it.id) : undefined;
    return p ? [{ shape: p.kind, label: p.label }] : [];
  });
  const lined = items.filter((it): it is Selection & { line: number } => 'line' in it).sort((a, b) => a.line - b.line);
  const stmts = lined.flatMap((it) => s.doc.lines.slice(it.line, endOf(it) + 1).map((l) => l.stmt));
  const end = lined.length ? Math.max(...lined.map(endOf)) : -1;
  return participants.length || stmts.length ? { kind: 'seq', participants, stmts, end } : null;
}

// Mermaid text for the system clipboard
function textOf(c: Clip): string {
  if (c.kind === 'flow')
    return [
      ...c.nodes.map((n) => formatFlowStatement({ type: 'chain', groups: [[{ id: n.id, shape: n.shape, text: n.label }]], links: [] })),
      ...c.edges.map((e) => formatFlowStatement({ type: 'chain', groups: [[{ id: e.from }], [{ id: e.to }]], links: [e.link] })),
    ].join('\n');
  return [...c.participants.map((p) => formatStatement({ type: 'participant', kind: p.shape, id: p.label.replace(/\s+/g, '_') })), ...c.stmts.map(formatStatement)].join('\n');
}

function toSystem(c: Clip) {
  try {
    void navigator.clipboard?.writeText(textOf(c)).catch(() => {});
  } catch {
    // ignore
  }
}

// Top-level statements -> selections, starting at line `at`
function topLevel(stmts: Statement[], at: number): Selection[] {
  const out: Selection[] = [];
  let depth = 0;
  stmts.forEach((st, i) => {
    if (depth === 0 && st.type === 'message') out.push({ kind: 'message', line: at + i });
    if (depth === 0 && st.type === 'note') out.push({ kind: 'note', line: at + i });
    if (depth === 0 && st.type === 'block') out.push({ kind: 'frame', line: at + i });
    if (st.type === 'block') depth++;
    if (st.type === 'end') depth--;
  });
  return out;
}

function paste(c: Clip, n: number) {
  const s = S();
  if ((c.kind === 'flow') !== !!s.flow) return toast('Copied items belong to the other diagram type', 'error');
  if (c.kind === 'flow') {
    if (c.nodes.length) return flowActions.pasteMany(c.nodes, c.edges, { x: STEP * n, y: STEP * n });
    return c.edges.forEach((e) => flowActions.pasteEdge(e.from, e.to, e.link));
  }
  // Participants first (their lines go above the statements)
  let lines = s.doc.lines;
  const before = lines.length;
  const ids: string[] = [];
  for (const p of c.participants) {
    const doc = analyze(lines);
    const r = addParticipant(doc, p.shape, `${p.label} copy`, doc.participants.length);
    lines = r.lines;
    ids.push(r.id);
  }
  let at = c.end >= 0 ? c.end + 1 + (lines.length - before) : contentEnd(lines);
  while (at > 0 && lines[at - 1]?.stmt.type === 'blank') at--;
  lines = insertStatements(lines, at, c.stmts);
  s.commit(lines, { multi: [...ids.map((id) => ({ kind: 'participant' as const, id })), ...topLevel(c.stmts, at)] });
}

// Delete several items in one step
export function deleteItems(items: Selection[]) {
  const s = S();
  if (items.length === 1) return actions.deleteSelection(items[0]);
  if (s.flow) {
    const nodes = items.flatMap((it) => (it.kind === 'node' ? [it.id] : []));
    const edges = items.flatMap((it) => (it.kind === 'edge' ? [it.index] : []));
    return flowActions.flowDeleteMany(nodes, edges);
  }
  const drop: number[] = [];
  for (const it of items) if ('line' in it) for (let i = it.line; i <= endOf(it); i++) drop.push(i);
  let lines = removeLines(s.doc.lines, drop);
  for (const it of items) if (it.kind === 'participant') lines = deleteParticipant(analyze(lines), it.id);
  s.commit(lines, { select: null });
}

export function copySelection() {
  const c = take(selectedItems());
  if (!c) return false;
  clip = c;
  pastes = 0;
  toSystem(c);
  return true;
}

export function cutSelection() {
  const items = selectedItems();
  if (copySelection()) deleteItems(items);
}

export function pasteClipboard() {
  if (!clip) return;
  pastes++;
  paste(clip, pastes);
}

// Copy + paste in one step, leaving the clipboard alone
export function duplicateSelection() {
  const c = take(selectedItems());
  if (c) paste(c, 1);
}
