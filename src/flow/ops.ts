// Flowchart line operations
import type { FlowDir, FlowDoc, FlowLine, FlowShape, FlowStatement, Link, NodeRef } from './model';
import { analyzeFlow } from './parser';

type Chain = FlowStatement & { type: 'chain' };

const fresh = (stmt: FlowStatement): FlowLine => ({ raw: null, indent: '', stmt });

export const defaultLink = (): Link => ({ stroke: 'normal', start: 'none', end: 'arrow', length: 1 });

type Mapped = FlowStatement | FlowStatement[] | null;
const list = (m: Mapped): FlowStatement[] => (m ? (Array.isArray(m) ? m : [m]) : []);

// Map statements of a line (handles `;` lines)
function mapLine(lines: FlowLine[], i: number, part: number, fn: (s: FlowStatement) => Mapped): FlowLine[] {
  const s = lines[i].stmt;
  const out = lines.slice();
  if (s.type === 'multi') {
    const parts = s.parts.flatMap((p, k) => (k === part ? list(fn(p)) : [p]));
    if (!parts.length) out.splice(i, 1);
    else out[i] = fresh(parts.length === 1 ? parts[0] : { type: 'multi', parts });
    return out;
  }
  // Several statements -> several lines
  out.splice(i, 1, ...list(fn(s)).map(fresh));
  return out;
}

// Parts of a line
const partsOf = (s: FlowStatement): FlowStatement[] => (s.type === 'multi' ? s.parts : [s]);

// Content end
export function flowContentEnd(lines: FlowLine[]): number {
  let i = lines.length;
  while (i > 0 && lines[i - 1].stmt.type === 'blank') i--;
  const header = lines.findIndex((l) => l.stmt.type === 'header');
  return Math.max(i, header + 1);
}

// Insert before styles
function insertAt(lines: FlowLine[], at: number, stmts: FlowStatement[]): FlowLine[] {
  const out = lines.slice();
  out.splice(at, 0, ...stmts.map(fresh));
  return out;
}

const STYLING = new Set(['classDef', 'class', 'style', 'linkStyle', 'other']);

// Line for new content (before trailing style lines)
export function flowInsertLine(doc: FlowDoc, subgraph?: string): number {
  if (subgraph) {
    const sg = doc.subgraphs.find((s) => s.id === subgraph);
    if (sg && sg.endLine >= 0) return sg.endLine;
  }
  const end = flowContentEnd(doc.lines);
  const type = (i: number) => doc.lines[i].stmt.type;
  let i = end;
  while (i > 0 && (STYLING.has(type(i - 1)) || type(i - 1) === 'blank' || type(i - 1) === 'comment')) i--;
  return doc.lines.slice(i, end).some((l) => STYLING.has(l.stmt.type)) ? i : end;
}

export function uniqueNodeId(doc: FlowDoc, base = 'n'): string {
  const taken = new Set([...doc.nodes.map((n) => n.id), ...doc.subgraphs.map((s) => s.id)]);
  let k = doc.nodes.length + 1;
  while (taken.has(`${base}${k}`)) k++;
  return `${base}${k}`;
}

// Ref holding a node's label
function labelRef(doc: FlowDoc, id: string): { line: number; part: number } | null {
  const n = doc.nodes.find((x) => x.id === id);
  if (!n) return null;
  const line = n.declLine ?? n.firstLine;
  const parts = partsOf(doc.lines[line].stmt);
  for (let k = parts.length - 1; k >= 0; k--) {
    const p = parts[k];
    if (p.type !== 'chain') continue;
    const has = p.groups.some((g) => g.some((r) => r.id === id && (n.declLine === undefined || r.text !== undefined || r.shape)));
    if (has) return { line, part: k };
  }
  return null;
}

// Patch the defining ref
function patchRef(doc: FlowDoc, id: string, fn: (r: NodeRef) => NodeRef): FlowLine[] {
  const at = labelRef(doc, id);
  if (!at) return doc.lines;
  const n = doc.nodes.find((x) => x.id === id)!;
  return mapLine(doc.lines, at.line, at.part, (s) => {
    if (s.type !== 'chain') return s;
    let done = false;
    // Last defining ref
    const groups = s.groups.map((g) => g.slice());
    for (let gi = groups.length - 1; gi >= 0 && !done; gi--) {
      for (let ri = groups[gi].length - 1; ri >= 0 && !done; ri--) {
        const r = groups[gi][ri];
        if (r.id !== id) continue;
        if (n.declLine !== undefined && r.text === undefined && !r.shape) continue;
        groups[gi][ri] = fn(r);
        done = true;
      }
    }
    return { ...s, groups };
  });
}

// Bracket form (drops `@{}`)
const bracket = (r: NodeRef, patch: Partial<NodeRef>): NodeRef => ({ id: r.id, shape: r.shape ?? 'rect', text: r.text, classes: r.classes, ...patch });

export function setNodeLabel(doc: FlowDoc, id: string, label: string): FlowLine[] {
  label = label.trim();
  if (!label) return doc.lines;
  return patchRef(doc, id, (r) => bracket(r, { text: label }));
}

export function setNodeShape(doc: FlowDoc, id: string, shape: FlowShape): FlowLine[] {
  const n = doc.nodes.find((x) => x.id === id);
  if (!n) return doc.lines;
  return patchRef(doc, id, (r) => bracket(r, { shape, text: r.text ?? n.label }));
}

export function addNode(doc: FlowDoc, shape: FlowShape, label: string, opts: { subgraph?: string; from?: string } = {}): { lines: FlowLine[]; id: string; line: number } {
  const id = uniqueNodeId(doc);
  const ref: NodeRef = { id, shape, text: label };
  const stmt: FlowStatement = opts.from ? { type: 'chain', groups: [[{ id: opts.from }], [ref]], links: [defaultLink()] } : { type: 'chain', groups: [[ref]], links: [] };
  const line = flowInsertLine(doc, opts.subgraph);
  return { lines: insertAt(doc.lines, line, [stmt]), id, line };
}

export function addEdge(doc: FlowDoc, from: string, to: string, link: Link = defaultLink()): { lines: FlowLine[]; line: number } {
  const line = flowInsertLine(doc);
  return { lines: insertAt(doc.lines, line, [{ type: 'chain', groups: [[{ id: from }], [{ id: to }]], links: [link] }]), line };
}

// Split a chain into single edges
function explode(s: Chain): Chain[] {
  const out: Chain[] = [];
  const defined = new Set<string>();
  const ref = (r: NodeRef): NodeRef => {
    if (defined.has(r.id)) return { id: r.id };
    if (r.text !== undefined || r.shape || r.classes) defined.add(r.id);
    return r;
  };
  if (!s.links.length) return [s];
  s.links.forEach((link, k) => {
    for (const a of s.groups[k]) for (const b of s.groups[k + 1]) out.push({ type: 'chain', groups: [[ref(a)], [ref(b)]], links: [link] });
  });
  return out;
}

// Rewrite an edge's chain
function rewriteEdge(doc: FlowDoc, index: number, fn: (c: Chain) => Chain | null): FlowLine[] {
  const e = doc.edges[index];
  if (!e) return doc.lines;
  return mapLine(doc.lines, e.line, e.part, (s) => {
    if (s.type !== 'chain') return s;
    const pieces = explode(s);
    // Find exploded edge
    const target = pieces.findIndex((p) => p.groups[0][0].id === e.from && p.groups[1][0].id === e.to && s.links.indexOf(p.links[0]) === e.link);
    if (target < 0) return s;
    const next = pieces.flatMap((p, i) => {
      if (i !== target) return [p];
      const r = fn(p);
      // Keep dropped endpoints that carry labels
      const kept = r ? r.groups.flat().map((x) => x.id) : [];
      const orphans = p.groups.flat().filter((x) => (x.text !== undefined || x.shape) && !kept.includes(x.id)).map((x): Chain => ({ type: 'chain', groups: [[x]], links: [] }));
      return r ? [r, ...orphans] : orphans;
    });
    return merge(next);
  });
}

// Rejoin simple chains
function merge(pieces: Chain[]): FlowStatement[] {
  if (pieces.length <= 1) return pieces;
  // Re-chain A-->B, B-->C
  const out: Chain = { type: 'chain', groups: [pieces[0].groups[0]], links: [] };
  let ok = true;
  for (const p of pieces) {
    if (!p.links.length) {
      ok = false;
      break;
    }
    const lastGroup = out.groups[out.groups.length - 1];
    if (out.links.length && (lastGroup.length !== 1 || lastGroup[0].id !== p.groups[0][0].id)) {
      ok = false;
      break;
    }
    out.links.push(p.links[0]);
    out.groups.push(p.groups[1]);
  }
  return ok ? [out] : pieces;
}

export function setEdge(doc: FlowDoc, index: number, patch: Partial<Link> & { from?: string; to?: string }): FlowLine[] {
  const e = doc.edges[index];
  if (!e) return doc.lines;
  const { from, to, ...linkPatch } = patch;
  if (from === undefined && to === undefined) {
    // Patch the link in place
    return mapLine(doc.lines, e.line, e.part, (s) => (s.type === 'chain' ? { ...s, links: s.links.map((l, k) => (k === e.link ? { ...l, ...linkPatch } : l)) } : s));
  }
  return rewriteEdge(doc, index, (c) => ({
    ...c,
    groups: [[from !== undefined ? { id: from } : c.groups[0][0]], [to !== undefined ? { id: to } : c.groups[1][0]]],
    links: [{ ...c.links[0], ...linkPatch }],
  }));
}

export function reverseEdge(doc: FlowDoc, index: number): FlowLine[] {
  const e = doc.edges[index];
  if (!e) return doc.lines;
  return rewriteEdge(doc, index, (c) => ({ ...c, groups: [c.groups[1], c.groups[0]] }));
}

export function deleteEdge(doc: FlowDoc, index: number): FlowLine[] {
  const e = doc.edges[index];
  if (!e) return doc.lines;
  const lines = rewriteEdge(doc, index, () => null);
  // Keep orphaned nodes
  const after = analyzeFlow(lines);
  const missing = [e.from, e.to].filter((id) => doc.nodes.some((n) => n.id === id) && !after.nodes.some((n) => n.id === id));
  if (!missing.length) return lines;
  // Sender before, receiver after
  const kept = lines.length === doc.lines.length;
  const node = (id: string): FlowStatement => ({ type: 'chain', groups: [[{ id }]], links: [] });
  let out = lines;
  if (missing.includes(e.to)) out = insertAt(out, kept ? e.line + 1 : e.line, [node(e.to)]);
  if (missing.includes(e.from) && e.from !== e.to) out = insertAt(out, e.line, [node(e.from)]);
  return out;
}

export function deleteNode(doc: FlowDoc, id: string): FlowLine[] {
  const out: FlowLine[] = [];
  const dropPart = (s: FlowStatement): Mapped => {
    switch (s.type) {
      case 'chain': {
        if (!s.groups.some((g) => g.some((r) => r.id === id))) return s;
        const pieces = explode(s)
          .map((p): Chain | null => {
            const groups = p.groups.map((g) => g.filter((r) => r.id !== id));
            if (groups.every((g) => g.length)) return { ...p, groups };
            // Keep the other end's label
            const rest = groups.flat().filter((r) => r.text !== undefined || r.shape);
            return rest.length ? { type: 'chain', groups: [rest], links: [] } : null;
          })
          .filter((p): p is Chain => !!p);
        return merge(pieces);
      }
      case 'class': {
        const ids = s.ids.filter((x) => x !== id);
        return ids.length ? { ...s, ids } : null;
      }
      case 'style':
        return s.id === id ? null : s;
      case 'other':
        return /^click\s+/.test(s.text) && s.text.split(/\s+/)[1] === id ? null : s;
      case 'multi': {
        const parts = s.parts.flatMap((p) => list(dropPart(p)));
        return parts.length ? (parts.length === 1 ? parts[0] : { type: 'multi', parts }) : null;
      }
      default:
        return s;
    }
  };
  for (const l of doc.lines) {
    const next = dropPart(l.stmt);
    if (next === l.stmt) out.push(l);
    else out.push(...list(next).map(fresh));
  }
  return out;
}

export function renameSubgraph(doc: FlowDoc, id: string, title: string): FlowLine[] {
  const sg = doc.subgraphs.find((s) => s.id === id);
  title = title.trim();
  if (!sg || !title) return doc.lines;
  const s = doc.lines[sg.line].stmt;
  if (s.type !== 'subgraph') return doc.lines;
  // `subgraph Some title` has no usable id
  const plain = (s.title === undefined || s.title === s.id) && !/^[\w-]+$/.test(s.id);
  const out = doc.lines.slice();
  out[sg.line] = fresh(plain ? { type: 'subgraph', id: title, title } : { type: 'subgraph', id: s.id, title });
  return out;
}

// Remove subgraph, keep contents
export function unwrapSubgraph(doc: FlowDoc, id: string): FlowLine[] {
  const sg = doc.subgraphs.find((s) => s.id === id);
  if (!sg) return doc.lines;
  const drop = new Set([sg.line, sg.endLine]);
  return doc.lines
    .map((l, i) => (i > sg.line && i < sg.endLine && l.stmt.type !== 'blank' ? { ...l, raw: null } : l))
    .filter((_, i) => !drop.has(i));
}

export function addSubgraph(doc: FlowDoc, title: string): { lines: FlowLine[]; id: string; line: number } {
  const taken = new Set(doc.subgraphs.map((s) => s.id));
  let k = doc.subgraphs.length + 1;
  while (taken.has(`group${k}`)) k++;
  const id = `group${k}`;
  const node = uniqueNodeId(doc);
  const line = flowInsertLine(doc);
  const lines = insertAt(doc.lines, line, [{ type: 'subgraph', id, title }, { type: 'chain', groups: [[{ id: node, shape: 'rect', text: 'Step' }]], links: [] }, { type: 'end' }]);
  return { lines, id, line };
}

export function setDirection(doc: FlowDoc, dir: FlowDir): FlowLine[] {
  const i = doc.lines.findIndex((l) => l.stmt.type === 'header');
  if (i < 0) return doc.lines;
  const s = doc.lines[i].stmt as FlowStatement & { type: 'header' };
  const out = doc.lines.slice();
  out[i] = fresh({ ...s, dir });
  return out;
}
