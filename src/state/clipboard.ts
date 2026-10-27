// Copy / cut / paste / duplicate for the canvas selection
import type { ParticipantKind, Statement } from '../core/model';
import { addParticipant, findBlockEnd, insertStatements } from '../core/ops';
import { formatStatement } from '../core/serializer';
import type { FlowShape, Link } from '../flow/model';
import { formatFlowStatement } from '../flow/serializer';
import * as actions from './actions';
import * as flowActions from './flowActions';
import { current as S, type Selection } from './store';
import { toast } from './toast';

type Clip =
  | { kind: 'participant'; shape: ParticipantKind; label: string }
  | { kind: 'statements'; stmts: Statement[]; select: 'message' | 'note' | 'frame' }
  | { kind: 'node'; shape: FlowShape; label: string; classes: string[]; x: number; y: number; parent?: string }
  | { kind: 'edge'; from: string; to: string; link: Link };

// Offset for repeated pastes
const STEP = 32;
let clip: Clip | null = null;
let pastes = 0;

// Selection -> clipboard entry
function take(sel: Selection): Clip | null {
  const s = S();
  if (s.flow) {
    if (sel.kind === 'node') {
      const n = s.flow.nodes.find((q) => q.id === sel.id);
      const at = s.flowLayout?.nodes.find((q) => q.id === sel.id);
      return n && at ? { kind: 'node', shape: n.shape, label: n.label, classes: n.classes, x: at.x, y: at.y, parent: n.parent } : null;
    }
    if (sel.kind === 'edge') {
      const e = s.flow.edges[sel.index];
      return e ? { kind: 'edge', from: e.from, to: e.to, link: e.spec } : null;
    }
    return null;
  }
  if (sel.kind === 'participant') {
    const p = s.doc.participants.find((q) => q.id === sel.id);
    return p ? { kind: 'participant', shape: p.kind, label: p.label } : null;
  }
  if (sel.kind === 'message' || sel.kind === 'note' || sel.kind === 'frame') {
    const end = sel.kind === 'frame' ? findBlockEnd(s.doc.lines, sel.line) : sel.line;
    const stmts = s.doc.lines.slice(sel.line, end + 1).map((l) => l.stmt);
    return { kind: 'statements', stmts, select: sel.kind };
  }
  return null;
}

// Mermaid text for the system clipboard
function textOf(c: Clip): string {
  switch (c.kind) {
    case 'statements':
      return c.stmts.map(formatStatement).join('\n');
    case 'participant':
      return formatStatement({ type: 'participant', kind: c.shape, id: c.label.replace(/\s+/g, '_'), alias: undefined });
    case 'node':
      return formatFlowStatement({ type: 'chain', groups: [[{ id: 'n', shape: c.shape, text: c.label }]], links: [] });
    case 'edge':
      return formatFlowStatement({ type: 'chain', groups: [[{ id: c.from }], [{ id: c.to }]], links: [c.link] });
  }
}

function put(c: Clip | null): Clip | null {
  if (!c) return null;
  try {
    void navigator.clipboard?.writeText(textOf(c)).catch(() => {});
  } catch {
    // ignore
  }
  return c;
}

// Insert a clipboard entry; `after` places sequence statements right after the source
function paste(c: Clip, n: number, after?: Selection | null) {
  const s = S();
  if ((c.kind === 'node' || c.kind === 'edge') !== !!s.flow) return toast('Copied item belongs to the other diagram type', 'error');
  switch (c.kind) {
    case 'node':
      return flowActions.pasteNode(c.shape, c.label, c.classes, { x: c.x + STEP * n, y: c.y + STEP * n }, c.parent);
    case 'edge':
      return flowActions.pasteEdge(c.from, c.to, c.link);
    case 'participant': {
      const at = after?.kind === 'participant' ? s.doc.participants.findIndex((p) => p.id === after.id) + 1 : s.doc.participants.length;
      const { lines, id } = addParticipant(s.doc, c.shape, `${c.label} copy`, at);
      return s.commit(lines, { select: { kind: 'participant', id } });
    }
    case 'statements': {
      const src = after && 'line' in after ? (after.kind === 'frame' ? findBlockEnd(s.doc.lines, after.line) : after.line) : s.doc.lines.length - 1;
      let at = src + 1;
      while (at > 0 && s.doc.lines[at - 1]?.stmt.type === 'blank') at--;
      return s.commit(insertStatements(s.doc.lines, at, c.stmts), { select: { kind: c.select, line: at } });
    }
  }
}

export function copySelection(sel: Selection | null) {
  const c = sel && put(take(sel));
  if (!c) return false;
  clip = c;
  pastes = 0;
  return true;
}

export function cutSelection(sel: Selection | null) {
  if (!sel || !copySelection(sel)) return;
  actions.deleteSelection(sel);
}

export function pasteClipboard() {
  if (!clip) return;
  pastes++;
  paste(clip, pastes, S().selection);
}

// Copy + paste in one step, leaving the clipboard alone
export function duplicateSelection(sel: Selection | null) {
  const c = sel && take(sel);
  if (c) paste(c, 1, sel);
}
