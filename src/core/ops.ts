// Line operations
import { analyze } from './parser';
import type { ArrowToken, BlockKind, Doc, Line, NotePlacement, ParticipantKind, Statement } from './model';

const fresh = (stmt: Statement): Line => ({ raw: null, indent: '', stmt });

export function setStatement(lines: Line[], i: number, stmt: Statement): Line[] {
  const out = lines.slice();
  out[i] = fresh(stmt);
  return out;
}

export function insertStatements(lines: Line[], at: number, stmts: Statement[]): Line[] {
  const out = lines.slice();
  out.splice(at, 0, ...stmts.map(fresh));
  return out;
}

export function removeLines(lines: Line[], indices: number[]): Line[] {
  const drop = new Set(indices);
  return lines.filter((_, i) => !drop.has(i));
}

// Move line
export function moveLine(lines: Line[], from: number, to: number): { lines: Line[]; index: number } {
  return moveRange(lines, from, from, to);
}

// Move lines first..last
export function moveRange(lines: Line[], first: number, last: number, to: number): { lines: Line[]; index: number } {
  if (to >= first && to <= last + 1) return { lines, index: first };
  const out = lines.slice();
  const moved = out.splice(first, last - first + 1);
  const index = to > last ? to - moved.length : to;
  // Re-indent
  out.splice(index, 0, ...moved.map((l) => fresh(l.stmt)));
  return { lines: out, index };
}

// Preamble end
export function preambleEnd(lines: Line[]): number {
  let i = lines.findIndex((l) => l.stmt.type === 'header');
  if (i < 0) return 0;
  i++;
  while (i < lines.length && ['title', 'autonumber'].includes(lines[i].stmt.type)) i++;
  return i;
}

// Content end
export function contentEnd(lines: Line[]): number {
  let i = lines.length;
  while (i > 0 && lines[i - 1].stmt.type === 'blank') i--;
  return Math.max(i, preambleEnd(lines));
}

export function findBlockEnd(lines: Line[], start: number): number {
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    const t = lines[i].stmt.type;
    if (t === 'block') depth++;
    else if (t === 'end' && --depth === 0) return i;
  }
  return -1;
}

const VALID_ID = /^[^\-<>:,;+\n%]+$/;

export function uniqueId(doc: Doc, base: string): string {
  const taken = new Set(doc.participants.map((p) => p.id));
  const clean = base.replace(/[^A-Za-z0-9_]/g, '') || 'P';
  if (!taken.has(clean)) return clean;
  let n = 2;
  while (taken.has(`${clean}${n}`)) n++;
  return `${clean}${n}`;
}

// Reorder participants
export function reorderParticipants(doc: Doc, order: string[]): Line[] {
  const declared = new Map(doc.participants.filter((p) => p.declLine !== undefined).map((p) => [p.id, doc.lines[p.declLine!]]));
  let lines = removeLines(doc.lines, [...declared.values()].map((l) => doc.lines.indexOf(l)));
  const at = preambleEnd(lines);
  const decls = order.map((id) => {
    const existing = declared.get(id);
    if (existing) return existing;
    return fresh({ type: 'participant', kind: 'participant', id });
  });
  lines = lines.slice();
  lines.splice(at, 0, ...decls);
  return lines;
}

export function addParticipant(doc: Doc, kind: ParticipantKind, label: string, index = doc.participants.length): { lines: Line[]; id: string } {
  const id = uniqueId(doc, label);
  const lines = insertStatements(doc.lines, preambleEnd(doc.lines), [{ type: 'participant', kind, id, alias: label !== id ? label : undefined }]);
  const order = doc.participants.map((p) => p.id);
  order.splice(index, 0, id);
  return { lines: reorderParticipants(analyze(lines), order), id };
}

// Rename participant
export function renameParticipant(doc: Doc, id: string, label: string): Line[] {
  label = label.trim();
  const p = doc.participants.find((x) => x.id === id);
  if (!p || !label) return doc.lines;
  const hasAlias = p.label !== p.id;
  const canRenameId = !hasAlias && VALID_ID.test(label) && !/\sas\s/.test(label) && !doc.participants.some((x) => x.id === label);
  if (canRenameId) {
    const r = (x: string) => (x === id ? label : x);
    return doc.lines.map((l) => {
      const s = l.stmt;
      switch (s.type) {
        case 'participant':
          return s.id === id ? fresh({ ...s, id: label }) : l;
        case 'message':
          return s.from === id || s.to === id ? fresh({ ...s, from: r(s.from), to: r(s.to) }) : l;
        case 'note':
          return s.actors.includes(id) ? fresh({ ...s, actors: s.actors.map(r) }) : l;
        case 'activate':
        case 'deactivate':
          return s.actor === id ? fresh({ ...s, actor: label }) : l;
        default:
          return l;
      }
    });
  }
  if (p.declLine !== undefined) {
    const s = doc.lines[p.declLine].stmt as Statement & { type: 'participant' };
    return setStatement(doc.lines, p.declLine, { ...s, alias: label });
  }
  return insertStatements(doc.lines, preambleEnd(doc.lines), [{ type: 'participant', kind: p.kind, id, alias: label }]);
}

export function setParticipantKind(doc: Doc, id: string, kind: ParticipantKind): Line[] {
  const p = doc.participants.find((x) => x.id === id);
  if (!p) return doc.lines;
  const alias = p.label !== p.id ? p.label : undefined;
  if (p.declLine !== undefined) return setStatement(doc.lines, p.declLine, { type: 'participant', kind, id, alias });
  // Keep order
  const lines = insertStatements(doc.lines, preambleEnd(doc.lines), [{ type: 'participant', kind, id, alias }]);
  return reorderParticipants(analyze(lines), doc.participants.map((x) => x.id));
}

// Delete participant
export function deleteParticipant(doc: Doc, id: string): Line[] {
  const out: Line[] = [];
  for (const l of doc.lines) {
    const s = l.stmt;
    if (s.type === 'participant' && s.id === id) continue;
    if (s.type === 'message' && (s.from === id || s.to === id)) continue;
    if ((s.type === 'activate' || s.type === 'deactivate') && s.actor === id) continue;
    if (s.type === 'note' && s.actors.includes(id)) {
      const rest = s.actors.filter((a) => a !== id);
      if (!rest.length) continue;
      out.push(fresh({ ...s, actors: rest }));
      continue;
    }
    out.push(l);
  }
  return out;
}

export function messageStmt(from: string, to: string, text: string, arrow: ArrowToken = '->>'): Statement {
  return { type: 'message', from, to, arrow, text };
}

export function noteStmt(placement: NotePlacement, actors: string[], text: string): Statement {
  return { type: 'note', placement, actors, text };
}

export function blockStmts(kind: BlockKind, label: string): Statement[] {
  const mid: Statement[] = kind === 'alt' ? [{ type: 'branch', kind: 'else', label: 'otherwise' }] : kind === 'par' ? [{ type: 'branch', kind: 'and', label: 'in parallel' }] : [];
  return [{ type: 'block', kind, label }, ...mid, { type: 'end' }];
}

// Unwrap block
export function unwrapBlock(lines: Line[], start: number): Line[] {
  const end = findBlockEnd(lines, start);
  if (end < 0) return removeLines(lines, [start]);
  const drop = [start, end];
  let depth = 0;
  for (let i = start + 1; i < end; i++) {
    const t = lines[i].stmt.type;
    if (t === 'block') depth++;
    else if (t === 'end') depth--;
    else if (t === 'branch' && depth === 0) drop.push(i);
  }
  // Re-indent
  const reindented = lines.map((l, i) => (i > start && i < end && l.stmt.type !== 'blank' ? { ...l, raw: null } : l));
  return removeLines(reindented, drop);
}

const fm = (text: string): Line => ({ raw: text, indent: '', stmt: { type: 'frontmatter', text } });

// Set theme
export function setConfigTheme(doc: Doc, theme: string): Line[] {
  const { config, lines } = doc;
  if (config.themeLine !== undefined) {
    const line = lines[config.themeLine];
    const text = line.raw ?? '';
    const next = text.replace(/(theme['"]?\s*:\s*['"]?)[\w-]+/, `$1${theme}`);
    const out = lines.slice();
    out[config.themeLine] = line.stmt.type === 'frontmatter' ? fm(next) : { ...line, raw: next, stmt: { type: 'comment', text: next.trim().slice(2) } };
    return out;
  }
  if (config.frontmatter) {
    const [start, end] = config.frontmatter;
    const cfg = lines.findIndex((l, i) => i > start && i < end && /^config\s*:\s*$/.test((l.stmt as { text: string }).text));
    const out = lines.slice();
    if (cfg >= 0) out.splice(cfg + 1, 0, fm(`  theme: ${theme}`));
    else out.splice(end, 0, fm('config:'), fm(`  theme: ${theme}`));
    return out;
  }
  return [fm('---'), fm('config:'), fm(`  theme: ${theme}`), fm('---'), ...lines];
}
