// Canvas actions
import { dropLine, nearestParticipant } from '../core/layout';
import { fromMermaidText, toMermaidText } from '../core/measure';
import type { BlockKind, LayoutOverrides, ParticipantKind, Statement } from '../core/model';
import { isParticipantKind, shapeOf } from '../core/participants';
import {
  addParticipant,
  blockStmts,
  contentEnd,
  deleteParticipant,
  findBlockEnd,
  insertStatements,
  messageStmt,
  moveRange,
  noteStmt,
  removeLines,
  renameParticipant,
  reorderParticipants,
  setParticipantKind,
  setStatement,
  unwrapBlock,
} from '../core/ops';
import { isBlankDiagram, startCode } from '../core/diagram';
import { analyze } from '../core/parser';
import { addFlowItem, flowDelete, flowEditText, flowSetText, type FlowPaletteItem } from './flowActions';
import { current as S, type EditTarget, type FlowSelection, type Selection } from './store';

const cloneOverrides = (o: LayoutOverrides): LayoutOverrides => ({ ...o, participants: Object.fromEntries(Object.entries(o.participants).map(([k, v]) => [k, { ...v }])) });

export type PaletteItem = ParticipantKind | 'message' | 'note' | Exclude<BlockKind, 'rect'> | FlowPaletteItem;

const isFlowItem = (i: PaletteItem): i is FlowPaletteItem => i === 'subgraph' || i.startsWith('flow:');

// Flowchart target
const isFlow = (t: EditTarget | Selection): t is FlowSelection => t.kind === 'node' || t.kind === 'edge' || t.kind === 'subgraph';


// Edit text
export function editText(t: EditTarget): string {
  if (isFlow(t)) return flowEditText(t);
  const { doc } = S();
  if (t.kind === 'participant') return doc.participants.find((p) => p.id === t.id)?.label ?? '';
  const s = doc.lines[t.line]?.stmt;
  if (!s) return '';
  if (s.type === 'message' || s.type === 'note') return fromMermaidText(s.text);
  if (s.type === 'block' || s.type === 'branch') return s.label;
  return '';
}

export function setText(t: EditTarget, text: string) {
  if (isFlow(t)) return flowSetText(t, text);
  const { doc, overrides } = S();
  if (t.kind === 'participant') {
    const lines = renameParticipant(doc, t.id, text.replace(/\s*\n\s*/g, ' '));
    const after = analyze(lines);
    const ov = cloneOverrides(overrides);
    let id = t.id;
    if (!after.participants.some((p) => p.id === t.id)) {
      // Keep overrides on rename
      id = after.participants.find((p) => !doc.participants.some((q) => q.id === p.id))?.id ?? t.id;
      if (ov.participants[t.id]) ov.participants[id] = ov.participants[t.id];
      delete ov.participants[t.id];
    }
    return S().commit(lines, { overrides: ov, select: { kind: 'participant', id } });
  }
  const s = doc.lines[t.line]?.stmt;
  if (!s) return;
  let next: Statement | null = null;
  if (s.type === 'message' || s.type === 'note') next = { ...s, text: toMermaidText(text) };
  else if (s.type === 'block' || s.type === 'branch') next = { ...s, label: text.replace(/\s*\n\s*/g, ' ').trim() };
  if (next) S().commit(setStatement(doc.lines, t.line, next));
}

export function deleteSelection(sel: Selection | null = S().selection) {
  if (!sel) return;
  if (isFlow(sel)) return flowDelete(sel);
  const { doc, overrides } = S();
  if (sel.kind === 'participant') {
    const ov = cloneOverrides(overrides);
    delete ov.participants[sel.id];
    return S().commit(deleteParticipant(doc, sel.id), { overrides: ov, select: null });
  }
  if (sel.kind === 'frame') return S().commit(unwrapBlock(doc.lines, sel.line), { select: null });
  S().commit(removeLines(doc.lines, [sel.line]), { select: null });
}

export function deleteBlockWithContents(line: number) {
  const { doc } = S();
  const end = findBlockEnd(doc.lines, line);
  const range = Array.from({ length: (end < 0 ? line : end) - line + 1 }, (_, i) => line + i);
  S().commit(removeLines(doc.lines, range), { select: null });
}

// Add palette item
export function addItem(item: PaletteItem, at?: { x: number; y: number }) {
  // First shape picks the kind
  const kind = isFlowItem(item) ? 'flowchart' : 'sequence';
  if (isBlankDiagram(S().code)) S().setCode(startCode(S().code, kind));
  if (isFlowItem(item)) return addFlowItem(item, at);
  const { doc, layout } = S();
  const end = contentEnd(doc.lines);
  const line = at ? dropLine(layout, at.y, end) : end;

  if (isParticipantKind(item)) {
    const index = at ? layout.participants.filter((p) => p.x < at.x).length : doc.participants.length;
    const { lines, id } = addParticipant(doc, item, shapeOf(item).defaultLabel, index);
    return S().commit(lines, { select: { kind: 'participant', id }, edit: { kind: 'participant', id } });
  }

  const ps = layout.participants;
  const near = (at && nearestParticipant(layout, at.x)) || ps[0];
  if (item === 'message') {
    const from = near?.id ?? 'Client';
    const to = ps[(near?.index ?? 0) + 1]?.id ?? ps[(near?.index ?? 0) - 1]?.id ?? (near ? near.id : 'Server');
    const lines = insertStatements(doc.lines, line, [messageStmt(from, to, 'request')]);
    return S().commit(lines, { select: { kind: 'message', line }, edit: { kind: 'message', line } });
  }
  if (item === 'note') {
    const actor = near?.id ?? 'Client';
    const dx = at && near ? at.x - near.x : 0;
    const placement = Math.abs(dx) < 30 ? 'over' : dx > 0 ? 'right of' : 'left of';
    const lines = insertStatements(doc.lines, line, [noteStmt(placement, [actor], 'Note')]);
    return S().commit(lines, { select: { kind: 'note', line }, edit: { kind: 'note', line } });
  }
  const lines = insertStatements(doc.lines, line, blockStmts(item, 'condition'));
  S().commit(lines, { select: { kind: 'frame', line }, edit: { kind: 'frame', line } });
}

// Move participant
export function moveParticipant(id: string, x: number) {
  const { doc, layout, overrides } = S();
  const ps = layout.participants;
  const cur = ps.find((p) => p.id === id);
  if (!cur) return;
  const others = ps.filter((p) => p.id !== id);
  const order = others.map((p) => p.id);
  order.splice(others.filter((p) => p.x < x).length, 0, id);
  const ov = cloneOverrides(overrides);
  const gap = (pid: string, value: number | undefined) => {
    ov.participants[pid] = { ...ov.participants[pid], gap: value };
    if (value === undefined) delete ov.participants[pid].gap;
  };
  if (order.every((pid, i) => pid === ps[i].id)) {
    const prev = ps[cur.index - 1];
    const next = ps[cur.index + 1];
    if (prev) gap(id, Math.round(x - prev.x));
    if (next) gap(next.id, Math.round(next.x - x));
    return S().setOverrides(ov);
  }
  // Reset spacing
  const oldNext = ps[cur.index + 1];
  const newNext = order[order.indexOf(id) + 1];
  [id, oldNext?.id, newNext].forEach((pid) => pid && gap(pid, undefined));
  S().commit(reorderParticipants(doc, order), { overrides: ov, select: { kind: 'participant', id } });
}

export function resizeParticipant(id: string, width: number, height: number) {
  const ov = cloneOverrides(S().overrides);
  ov.participants[id] = { ...ov.participants[id], width: Math.round(width), height: Math.round(height) };
  S().setOverrides(ov);
}

export function resetParticipantSize(id: string) {
  const ov = cloneOverrides(S().overrides);
  const { gap } = ov.participants[id] ?? {};
  ov.participants[id] = gap !== undefined ? { gap } : {};
  S().setOverrides(ov);
}

// Move statement
// Snap sideways drag to lifelines
export function horizontalShift(line: number, dx: number): { patch: Partial<Statement>; dx: number } | null {
  const { doc, layout } = S();
  const s = doc.lines[line]?.stmt;
  const ps = layout.participants;
  const idx = (id: string) => ps.findIndex((p) => p.id === id);
  const ids = s?.type === 'message' ? [s.from, s.to] : s?.type === 'note' ? s.actors : [];
  const first = ids.length ? ps[idx(ids[0])] : undefined;
  if (!first) return null;
  const near = nearestParticipant(layout, first.x + dx);
  const offset = near ? near.index - first.index : 0;
  if (!offset) return null;
  const moved = ids.map((id) => ps[idx(id) + offset]?.id);
  if (moved.some((id) => !id)) return null;
  const patch: Partial<Statement> = s!.type === 'message' ? { from: moved[0], to: moved[1] } : { actors: moved as string[] };
  return { patch, dx: ps[first.index + offset].x - first.x };
}

// Move statement or block
export function moveStatement(line: number, y: number, dx = 0) {
  const { doc, layout } = S();
  const s = doc.lines[line]?.stmt;
  if (s?.type !== 'message' && s?.type !== 'note' && s?.type !== 'block') return;
  let lines = doc.lines;
  const shift = s.type === 'block' ? null : horizontalShift(line, dx);
  if (shift) lines = setStatement(lines, line, { ...s, ...shift.patch } as Statement);
  const last = s.type === 'block' ? findBlockEnd(lines, line) : line;
  if (last < 0) return;
  const moved = moveRange(lines, line, last, dropLine(layout, y, contentEnd(lines)));
  if (moved.lines === doc.lines) return;
  const select: Selection = s.type === 'block' ? { kind: 'frame', line: moved.index } : { kind: s.type, line: moved.index };
  S().commit(moved.lines, { select });
}

export function connect(from: string, to: string, y: number) {
  const { doc, layout } = S();
  const line = dropLine(layout, y, contentEnd(doc.lines));
  const lines = insertStatements(doc.lines, line, [messageStmt(from, to, '')]);
  S().commit(lines, { select: { kind: 'message', line }, edit: { kind: 'message', line } });
}

export function updateStatement(line: number, patch: Partial<Statement>) {
  const { doc } = S();
  const s = doc.lines[line]?.stmt;
  if (!s) return;
  S().commit(setStatement(doc.lines, line, { ...s, ...patch } as Statement));
}

export function changeParticipantKind(id: string, kind: ParticipantKind) {
  S().commit(setParticipantKind(S().doc, id, kind));
}
