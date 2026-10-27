// Flowchart serializer
import { detectIndentUnit } from '../core/serializer';
import type { FlowLine, FlowStatement, Link, LinkEnd, NodeRef } from './model';
import { flowShapeOf } from './shapes';

const START: Record<LinkEnd, string> = { none: '', arrow: '<', circle: 'o', cross: 'x' };
const END: Record<LinkEnd, string> = { none: '', arrow: '>', circle: 'o', cross: 'x' };

// Quote label when needed
export function formatLabel(text: string): string {
  return /^[\p{L}\p{N} _.,:!?'+*=#&@$%-]*$/u.test(text) && text.trim() === text && text !== '' ? text : `"${text.replace(/"/g, '#quot;')}"`;
}

export function formatNodeRef(r: NodeRef): string {
  let out = r.id;
  if (r.meta) out += r.meta;
  else if (r.shape || r.text !== undefined) {
    const d = flowShapeOf(r.shape ?? 'rect');
    // No bracket form: @{ shape, label }
    if (!d.open) out += `@{ shape: ${d.aliases[0]}, label: "${(r.text || ' ').replace(/"/g, '#quot;')}" }`;
    else out += `${d.open}${formatLabel(r.text ?? r.id)}${d.close}`;
  }
  if (r.classes?.length) out += `:::${r.classes[0]}`;
  return out;
}

// Link token
export function linkToken(l: Link): string {
  const n = Math.max(1, l.length);
  const head = END[l.end];
  switch (l.stroke) {
    case 'invisible':
      return '~'.repeat(n + 2);
    case 'dotted':
      return `${START[l.start]}-${'.'.repeat(n)}-${head}`;
    case 'thick':
      return START[l.start] + (head ? '='.repeat(n + 1) + head : '='.repeat(n + 2));
    default:
      return START[l.start] + (head ? '-'.repeat(n + 1) + head : '-'.repeat(n + 2));
  }
}

export function formatLink(l: Link): string {
  const token = linkToken(l);
  if (!l.text || l.stroke === 'invisible') return ` ${token} `;
  if (l.inline && !/["|]/.test(l.text)) {
    // A -- text --> B
    const start = START[l.start] + (l.stroke === 'thick' ? '==' : l.stroke === 'dotted' ? '-.' : '--');
    const end = l.stroke === 'dotted' ? token.slice(START[l.start].length + 1) : token.slice(START[l.start].length);
    return ` ${start} ${l.text} ${end} `;
  }
  const text = /[|"]/.test(l.text) ? `"${l.text.replace(/"/g, '#quot;')}"` : l.text;
  return ` ${token}|${text}| `;
}

export function formatFlowStatement(s: FlowStatement): string {
  switch (s.type) {
    case 'header':
      return `${s.keyword} ${s.dir}`;
    case 'frontmatter':
      return s.text;
    case 'chain':
      return s.groups.map((g, i) => g.map(formatNodeRef).join(' & ') + (s.links[i] ? formatLink(s.links[i]) : '')).join('');
    case 'subgraph':
      return s.title === undefined || s.title === s.id ? `subgraph ${s.id}` : `subgraph ${s.id} [${formatLabel(s.title)}]`;
    case 'end':
      return 'end';
    case 'direction':
      return `direction ${s.dir}`;
    case 'classDef':
      return `classDef ${s.names.join(',')} ${s.style}`;
    case 'class':
      return `class ${s.ids.join(',')} ${s.name}`;
    case 'style':
      return `style ${s.id} ${s.style}`;
    case 'linkStyle':
      return `linkStyle ${s.indices === 'default' ? 'default' : s.indices.join(',')} ${s.style}`;
    case 'multi':
      return s.parts.map(formatFlowStatement).join('; ');
    case 'comment':
      return `%%${s.text}`;
    case 'blank':
      return '';
    case 'other':
    case 'unknown':
      return s.text;
  }
}

// Serialize lines
export function serializeFlow(lines: FlowLine[]): string {
  const unit = detectIndentUnit(lines);
  let depth = 0;
  return lines
    .map((l) => {
      const s = l.stmt;
      const own = s.type === 'end' ? depth - 1 : depth;
      if (s.type === 'subgraph') depth++;
      if (s.type === 'end') depth = Math.max(0, depth - 1);
      if (l.raw !== null) return l.raw;
      if (s.type === 'blank') return '';
      if (s.type === 'frontmatter') return s.text;
      const indent = s.type === 'header' ? '' : unit.repeat(1 + Math.max(0, own));
      return indent + formatFlowStatement(s);
    })
    .join('\n');
}
