import type { Line, Statement } from './model';
import { declarationOf } from './participants';

export function formatStatement(s: Statement): string {
  switch (s.type) {
    case 'header':
      return 'sequenceDiagram';
    case 'frontmatter':
      return s.text;
    case 'title':
      return `title ${s.text}`;
    case 'autonumber':
      return s.off ? 'autonumber off' : ['autonumber', s.start, s.step].filter((v) => v !== undefined).join(' ');
    case 'participant': {
      const { keyword, meta } = declarationOf(s.kind);
      const alias = s.alias && s.alias !== s.id ? ` as ${s.alias}` : '';
      return `${keyword} ${s.id}${meta}${alias}`;
    }
    case 'message':
      return `${s.from}${s.arrow}${s.activation ?? ''}${s.to}: ${s.text}`;
    case 'note':
      return `Note ${s.placement} ${s.actors.join(',')}: ${s.text}`;
    case 'block':
    case 'branch':
      return s.label ? `${s.kind} ${s.label}` : s.kind;
    case 'end':
      return 'end';
    case 'activate':
    case 'deactivate':
      return `${s.type} ${s.actor}`;
    case 'comment':
      return `%%${s.text}`;
    case 'blank':
      return '';
    case 'unknown':
      return s.text;
  }
}

// Serialize lines
export function serialize(lines: Line[]): string {
  const unit = detectIndentUnit(lines);
  let depth = 0;
  return lines
    .map((l) => {
      const s = l.stmt;
      const own = s.type === 'end' || s.type === 'branch' ? depth - 1 : depth;
      if (s.type === 'block') depth++;
      if (s.type === 'end') depth = Math.max(0, depth - 1);
      if (l.raw !== null) return l.raw;
      if (s.type === 'blank') return '';
      if (s.type === 'frontmatter') return s.text;
      const indent = s.type === 'header' ? '' : unit.repeat(1 + Math.max(0, own));
      return indent + formatStatement(s);
    })
    .join('\n');
}

export function detectIndentUnit(lines: { raw: string | null; indent: string; stmt: { type: string } }[]): string {
  for (const l of lines) {
    const t = l.stmt.type;
    if (t !== 'header' && t !== 'blank' && t !== 'frontmatter' && l.raw !== null && l.indent) return l.indent;
  }
  return '    ';
}
