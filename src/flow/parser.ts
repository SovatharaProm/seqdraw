// Flowchart parser
import { readConfig } from '../core/parser';
import type { ParseError } from '../core/model';
import type { FlowDir, FlowDoc, FlowEdge, FlowLine, FlowNode, FlowStatement, FlowSubgraph, Link, LinkEnd, LinkStroke, NodeRef } from './model';
import { FLOW_SHAPES, SHAPE_OPENERS, shapeFromAlias } from './shapes';

const DIRS: Record<string, FlowDir> = { TB: 'TB', TD: 'TD', BT: 'BT', LR: 'LR', RL: 'RL', '>': 'LR', '<': 'RL', '^': 'BT', v: 'TB' };

const RE = {
  header: /^(flowchart|graph)(?:\s+(TB|TD|BT|LR|RL|[<>^v]))?\s*;?\s*$/,
  comment: /^%%(.*)$/,
  subgraph: /^subgraph(?:\s+(.*?))?\s*;?\s*$/,
  end: /^end\s*;?\s*$/,
  direction: /^direction\s+(TB|TD|BT|LR|RL)\s*;?\s*$/,
  classDef: /^classDef\s+([^\s]+)\s+(.+?)\s*;?\s*$/,
  class: /^class\s+([^\s]+)\s+([^\s;]+)\s*;?\s*$/,
  style: /^style\s+([^\s]+)\s+(.+?)\s*;?\s*$/,
  linkStyle: /^linkStyle\s+(default|\d+(?:\s*,\s*\d+)*)\s+(.+?)\s*;?\s*$/,
  other: /^(click|accTitle|accDescr|call|href)\b/,
};

// Node id
const ID = /^[\p{L}\p{N}_]+(?:[.\-][\p{L}\p{N}_]+)*/u;

// Complete link token
const LINK = /^([<ox])?(-{2,}>|-{2,}[ox](?=[\s|]|$)|-{3,}|-\.+->|-\.+-[ox](?=[\s|]|$)|-\.+-|={2,}>|={2,}[ox](?=[\s|]|$)|={3,}|~{3,})/;
// Inline text link start
const LINK_START = /^([<ox])?(--|==|-\.)(?=\s)/;
const LINK_END: Record<string, RegExp> = {
  '--': /(-{2,}>|-{2,}[ox]|-{3,})(?=[\s\p{L}\p{N}_"]|$)/u,
  '==': /(={2,}>|={2,}[ox]|={3,})(?=[\s\p{L}\p{N}_"]|$)/u,
  '-.': /(\.+->|\.+-[ox]|\.+-)(?=[\s\p{L}\p{N}_"]|$)/u,
};

const HEAD: Record<string, LinkEnd> = { '>': 'arrow', '<': 'arrow', o: 'circle', x: 'cross' };

// Link token -> spec
function linkSpec(start: string | undefined, body: string): Omit<Link, 'text' | 'inline'> {
  const last = body[body.length - 1];
  const end = HEAD[last] ?? 'none';
  const core = end === 'none' ? body : body.slice(0, -1);
  let stroke: LinkStroke = 'normal';
  let length: number;
  if (core.startsWith('~')) {
    stroke = 'invisible';
    length = core.length - 2;
  } else if (core.includes('.')) {
    stroke = 'dotted';
    length = (core.match(/\./g) ?? []).length;
  } else {
    stroke = core.startsWith('=') ? 'thick' : 'normal';
    length = end === 'none' ? core.length - 2 : core.length - 1;
  }
  return { stroke, start: start ? HEAD[start] : 'none', end, length: Math.max(1, length) };
}

const unquote = (t: string) => {
  const s = t.trim();
  return /^".*"$/s.test(s) ? s.slice(1, -1) : s;
};

// Node reference
function readNode(text: string, pos: number): { ref: NodeRef; pos: number } | null {
  const m = text.slice(pos).match(ID);
  if (!m || m[0] === 'end') return null;
  const ref: NodeRef = { id: m[0] };
  pos += m[0].length;
  // @{ shape: ... }
  if (text.startsWith('@{', pos)) {
    const close = text.indexOf('}', pos);
    if (close < 0) return null;
    ref.meta = text.slice(pos, close + 1);
    const body = ref.meta.slice(2, -1);
    const shape = body.match(/shape\s*:\s*["']?([\w-]+)/)?.[1];
    const label = body.match(/label\s*:\s*(?:"([^"]*)"|'([^']*)'|([^,}]+))/);
    ref.shape = (shape && shapeFromAlias(shape)) || 'rect';
    if (label) ref.text = (label[1] ?? label[2] ?? label[3]).trim();
    pos = close + 1;
  } else {
    const open = SHAPE_OPENERS.find((o) => text.startsWith(o, pos));
    if (open) {
      const start = pos + open.length;
      const candidates = FLOW_SHAPES.filter((d) => d.open === open);
      let best: { shape: (typeof candidates)[number]; at: number; textEnd: number } | null = null;
      const quoted = text[start] === '"';
      const q = quoted ? text.indexOf('"', start + 1) : -1;
      if (quoted && q < 0) return null;
      for (const d of candidates) {
        let at: number;
        if (quoted) {
          const after = text.slice(q + 1).match(/^\s*/)![0].length + q + 1;
          at = text.startsWith(d.close, after) ? after : -1;
        } else at = text.indexOf(d.close, start);
        if (at >= 0 && (!best || at < best.at)) best = { shape: d, at, textEnd: quoted ? q + 1 : at };
      }
      if (!best) return null;
      ref.shape = best.shape.shape;
      ref.text = unquote(text.slice(start, best.textEnd));
      pos = best.at + best.shape.close.length;
    }
  }
  // :::class
  const cls = text.slice(pos).match(/^:::([\w-]+)/);
  if (cls) {
    ref.classes = [cls[1]];
    pos += cls[0].length;
  }
  return { ref, pos };
}

// Link with optional label
function readLink(text: string, pos: number): { link: Link; pos: number } | null {
  const rest = text.slice(pos);
  let m = rest.match(LINK);
  if (m) {
    const link: Link = linkSpec(m[1], m[2]);
    pos += m[0].length;
    const after = text.slice(pos).match(/^\s*\|((?:"[^"]*")|[^|]*)\|/);
    if (after) {
      link.text = unquote(after[1]);
      pos += after[0].length;
    }
    return { link, pos };
  }
  m = rest.match(LINK_START);
  if (!m) return null;
  const re = LINK_END[m[2]];
  const tail = rest.slice(m[0].length);
  const e = tail.match(re);
  if (!e || e.index === undefined) return null;
  const label = tail.slice(0, e.index).trim();
  const body = m[2] === '-.' ? `-${e[1]}` : e[1];
  const link: Link = { ...linkSpec(m[1], body), text: unquote(label), inline: true };
  return { link, pos: pos + m[0].length + e.index + e[1].length };
}

// Node chain
function readChain(text: string): (FlowStatement & { type: 'chain' }) | null {
  const groups: NodeRef[][] = [];
  const links: Link[] = [];
  let pos = 0;
  const ws = () => {
    while (pos < text.length && /\s/.test(text[pos])) pos++;
  };
  ws();
  for (;;) {
    const group: NodeRef[] = [];
    for (;;) {
      const n = readNode(text, pos);
      if (!n) return null;
      group.push(n.ref);
      pos = n.pos;
      ws();
      if (text[pos] !== '&') break;
      pos++;
      ws();
    }
    groups.push(group);
    if (pos >= text.length) break;
    const l = readLink(text, pos);
    if (!l) return null;
    links.push(l.link);
    pos = l.pos;
    ws();
    if (pos >= text.length) return null;
  }
  return { type: 'chain', groups, links };
}

// Split on `;` outside quotes and brackets
function splitStatements(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = false;
  let cur = '';
  for (const ch of text) {
    if (ch === '"') quote = !quote;
    else if (!quote && '[({'.includes(ch)) depth++;
    else if (!quote && '])}'.includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === ';' && !quote && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// Subgraph header
function readSubgraph(rest: string | undefined, line: number): FlowStatement {
  const t = (rest ?? '').trim();
  if (!t) return { type: 'subgraph', id: `subGraph${line}` };
  const m = t.match(/^([^\s[]+)\s*\[(.*)\]$/);
  if (m) return { type: 'subgraph', id: m[1], title: unquote(m[2]) };
  if (/^".*"$/.test(t)) return { type: 'subgraph', id: unquote(t), title: unquote(t) };
  return { type: 'subgraph', id: t, title: t };
}

export function parseFlowStatement(text: string, line = 0): FlowStatement {
  const t = text.trim();
  let m: RegExpMatchArray | null;
  if (!t) return { type: 'blank' };
  if ((m = t.match(RE.comment))) return { type: 'comment', text: m[1] };
  if ((m = t.match(RE.header))) return { type: 'header', keyword: m[1] as 'flowchart' | 'graph', dir: DIRS[m[2] ?? 'TB'] };
  if (RE.end.test(t)) return { type: 'end' };
  if ((m = t.match(RE.subgraph))) return readSubgraph(m[1], line);
  if ((m = t.match(RE.direction))) return { type: 'direction', dir: m[1] as FlowDir };
  if ((m = t.match(RE.classDef))) return { type: 'classDef', names: m[1].split(','), style: m[2] };
  if ((m = t.match(RE.class))) return { type: 'class', ids: m[1].split(','), name: m[2] };
  if ((m = t.match(RE.linkStyle))) return { type: 'linkStyle', indices: m[1] === 'default' ? 'default' : m[1].split(',').map(Number), style: m[2] };
  if ((m = t.match(RE.style))) return { type: 'style', id: m[1], style: m[2] };
  if (RE.other.test(t)) return { type: 'other', text: t };
  const parts = splitStatements(t);
  if (parts.length > 1) return { type: 'multi', parts: parts.map((p) => parseFlowStatement(p, line)) };
  return readChain(parts[0] ?? '') ?? { type: 'unknown', text: t };
}

function parseFlowLines(code: string): FlowLine[] {
  const raws = code.split(/\r?\n/);
  const first = raws.findIndex((r) => r.trim() !== '');
  const close = first >= 0 && raws[first].trim() === '---' ? raws.findIndex((r, i) => i > first && r.trim() === '---') : -1;
  return raws.map((raw, i) => ({
    raw,
    indent: raw.match(/^\s*/)![0],
    stmt: close > 0 && i >= first && i <= close ? { type: 'frontmatter', text: raw } : parseFlowStatement(raw, i),
  }));
}

// Analyze flowchart
export function analyzeFlow(lines: FlowLine[]): FlowDoc {
  const nodes: FlowNode[] = [];
  const byId = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  const subgraphs: FlowSubgraph[] = [];
  const classDefs: Record<string, string> = {};
  const errors: ParseError[] = [];
  const styles: { id: string; style: string }[] = [];
  const classAssign: { ids: string[]; name: string }[] = [];
  const linkStyles: { indices: number[] | 'default'; style: string }[] = [];
  let dir: FlowDir = 'TB';
  let sawHeader = false;
  // Open subgraphs with their mentions
  const stack: { sg: FlowSubgraph; ids: Set<string> }[] = [];

  const touch = (ref: NodeRef, line: number) => {
    let n = byId.get(ref.id);
    if (!n) {
      n = { id: ref.id, label: ref.id, shape: 'rect', firstLine: line, classes: [] };
      byId.set(ref.id, n);
      nodes.push(n);
    }
    if (ref.shape) n.shape = ref.shape;
    if (ref.text !== undefined) {
      n.label = ref.text;
      n.declLine = line;
    } else if (ref.shape) n.declLine = line;
    if (ref.classes) n.classes.push(...ref.classes);
    stack.forEach((s) => s.ids.add(ref.id));
  };

  const visit = (s: FlowStatement, i: number, part: number) => {
    switch (s.type) {
      case 'header':
        errors.push({ line: i, message: 'Duplicate flowchart header' });
        break;
      case 'chain':
        s.groups.forEach((g) => g.forEach((r) => touch(r, i)));
        s.links.forEach((link, k) => {
          for (const a of s.groups[k]) for (const b of s.groups[k + 1]) edges.push({ index: edges.length, line: i, part, link: k, from: a.id, to: b.id, spec: link });
        });
        break;
      case 'subgraph': {
        const sg: FlowSubgraph = { id: s.id, title: s.title ?? s.id, line: i, endLine: -1, parent: stack[stack.length - 1]?.sg.id };
        stack.forEach((o) => o.ids.add(s.id));
        stack.push({ sg, ids: new Set() });
        break;
      }
      case 'end': {
        const top = stack.pop();
        if (!top) {
          errors.push({ line: i, message: '"end" without a matching subgraph' });
          break;
        }
        top.sg.endLine = i;
        subgraphs.push(top.sg);
        // Innermost subgraph wins
        for (const id of top.ids) {
          const n = byId.get(id);
          if (n && n.parent === undefined) n.parent = top.sg.id;
        }
        break;
      }
      case 'direction': {
        const top = stack[stack.length - 1];
        if (top) top.sg.dir = s.dir;
        else dir = s.dir;
        break;
      }
      case 'classDef':
        s.names.forEach((n) => (classDefs[n] = s.style));
        break;
      case 'class':
        classAssign.push({ ids: s.ids, name: s.name });
        break;
      case 'style':
        styles.push({ id: s.id, style: s.style });
        break;
      case 'linkStyle':
        linkStyles.push({ indices: s.indices, style: s.style });
        break;
      case 'multi':
        s.parts.forEach((p, k) => visit(p, i, k));
        break;
      case 'unknown':
        errors.push({ line: i, message: `Unrecognized statement: ${s.text}` });
        break;
    }
  };

  lines.forEach(({ stmt: s }, i) => {
    if (s.type === 'blank' || s.type === 'comment' || s.type === 'frontmatter') return;
    if (!sawHeader) {
      sawHeader = true;
      if (s.type === 'header') {
        dir = s.dir;
        return;
      }
      errors.push({ line: i, message: 'Expected "flowchart" as the first statement' });
    }
    visit(s, i, 0);
  });
  for (const o of stack) errors.push({ line: o.sg.line, message: `Subgraph "${o.sg.title}" is never closed with "end"` });

  // Subgraph ids are not nodes
  const sgIds = new Set(subgraphs.map((s) => s.id));
  const realNodes = nodes.filter((n) => !sgIds.has(n.id) || n.declLine !== undefined);

  for (const c of classAssign) for (const id of c.ids) byId.get(id)?.classes.push(c.name);
  for (const st of styles) {
    const n = byId.get(st.id);
    if (n) n.style = n.style ? `${n.style},${st.style}` : st.style;
  }
  for (const ls of linkStyles) {
    const targets = ls.indices === 'default' ? edges : ls.indices.map((k) => edges[k]).filter(Boolean);
    targets.forEach((e) => (e.style = e.style ? `${e.style},${ls.style}` : ls.style));
  }

  const { config, title } = readConfig(lines);
  return { lines, dir, nodes: realNodes, edges, subgraphs: subgraphs.sort((a, b) => a.line - b.line), classDefs, title, config, errors };
}

export const parseFlow = (code: string) => analyzeFlow(parseFlowLines(code));
