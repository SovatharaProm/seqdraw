import {
  ARROW_TOKENS,
  type ArrowToken,
  type BlockKind,
  type BranchKind,
  type DiagramConfig,
  type Doc,
  type Line,
  type NotePlacement,
  type Participant,
  type ParticipantKind,
  type ParseError,
  type Statement,
} from './model';
import { isParticipantKind } from './participants';

// Participant id
const ID = String.raw`[^\-<>:,;+\n]+?`;
const ARROW_ALT = ARROW_TOKENS.map((t) => t.replace(/[()]/g, '\\$&')).join('|');

const RE = {
  header: /^sequenceDiagram\b\s*$/,
  comment: /^%%(.*)$/,
  title: /^title\s*:?\s*(.*)$/i,
  autonumber: /^autonumber(?:\s+(off)|\s+(\d+)(?:\s+(\d+))?)?\s*$/,
  // participant / actor declaration
  participant: new RegExp(String.raw`^(participant|actor)\s+(${ID})(?:@\{(.*?)\})?(?:\s+as\s+(.+))?$`),
  message: new RegExp(String.raw`^(${ID})\s*(${ARROW_ALT})\s*([+-]?)\s*(${ID})\s*(?::(.*))?$`),
  note: /^note\s+(left of|right of|over)\s+([^:]+?)\s*:(.*)$/i,
  block: /^(loop|alt|opt|par|critical|break|rect)\b\s*(.*)$/,
  branch: /^(else|and|option)\b\s*(.*)$/,
  end: /^end\s*$/,
  activation: /^(activate|deactivate)\s+(.+)$/,
};

export function parseStatement(text: string): Statement {
  const t = text.trim();
  let m: RegExpMatchArray | null;
  if (!t) return { type: 'blank' };
  if ((m = t.match(RE.comment))) return { type: 'comment', text: m[1] };
  if (RE.header.test(t)) return { type: 'header' };
  if ((m = t.match(RE.autonumber)))
    return m[1]
      ? { type: 'autonumber', off: true }
      : { type: 'autonumber', start: m[2] ? +m[2] : undefined, step: m[3] ? +m[3] : undefined };
  if ((m = t.match(RE.participant))) {
    let kind: ParticipantKind = m[1] as ParticipantKind;
    const type = m[3]?.match(/["']?type["']?\s*:\s*["']?(\w+)/)?.[1];
    if (type && isParticipantKind(type)) kind = type;
    return { type: 'participant', kind, id: m[2].trim(), alias: m[4]?.trim() };
  }
  if ((m = t.match(RE.note))) {
    return {
      type: 'note',
      placement: m[1].toLowerCase() as NotePlacement,
      actors: m[2].split(',').map((s) => s.trim()).filter(Boolean),
      text: m[3].trim(),
    };
  }
  if (RE.end.test(t)) return { type: 'end' };
  if ((m = t.match(RE.activation))) return { type: m[1] as 'activate' | 'deactivate', actor: m[2].trim() };
  if ((m = t.match(RE.block))) return { type: 'block', kind: m[1] as BlockKind, label: m[2].trim() };
  if ((m = t.match(RE.branch))) return { type: 'branch', kind: m[1] as BranchKind, label: m[2].trim() };
  if ((m = t.match(RE.message))) {
    return {
      type: 'message',
      from: m[1].trim(),
      arrow: m[2] as ArrowToken,
      activation: (m[3] || undefined) as '+' | '-' | undefined,
      to: m[4].trim(),
      text: (m[5] ?? '').trim(),
    };
  }
  if ((m = t.match(RE.title))) return { type: 'title', text: m[1].trim() };
  return { type: 'unknown', text: t };
}

export function parseLines(code: string): Line[] {
  const raws = code.split(/\r?\n/);
  // Frontmatter block
  const first = raws.findIndex((r) => r.trim() !== '');
  const close = first >= 0 && raws[first].trim() === '---' ? raws.findIndex((r, i) => i > first && r.trim() === '---') : -1;
  return raws.map((raw, i) => ({
    raw,
    indent: raw.match(/^\s*/)![0],
    stmt: close > 0 && i >= first && i <= close ? { type: 'frontmatter', text: raw } : parseStatement(raw),
  }));
}

const THEME_IN_DIRECTIVE = /['"]?theme['"]?\s*:\s*['"]([\w-]+)['"]/;

// Read config
function readConfig(lines: Line[]): { config: DiagramConfig; title?: string } {
  const config: DiagramConfig = {};
  let title: string | undefined;
  const fm = lines.map((l, i) => (l.stmt.type === 'frontmatter' ? i : -1)).filter((i) => i >= 0);
  if (fm.length) {
    config.frontmatter = [fm[0], fm[fm.length - 1]];
    let inConfig = false;
    for (const i of fm.slice(1, -1)) {
      const text = (lines[i].stmt as { text: string }).text;
      const m = text.match(/^(\s*)([\w-]+)\s*:\s*(.*?)\s*$/);
      if (!m) continue;
      const [, indent, key, value] = m;
      const unquoted = value.replace(/^(['"])(.*)\1$/, '$2');
      if (!indent) {
        inConfig = key === 'config';
        if (key === 'title' && unquoted) title = unquoted;
      } else if (inConfig && key === 'theme' && unquoted) {
        config.theme = unquoted;
        config.themeLine = i;
      }
    }
  }
  if (config.theme === undefined) {
    lines.forEach((l, i) => {
      const m = l.stmt.type === 'comment' && l.stmt.text.startsWith('{') ? l.stmt.text.match(THEME_IN_DIRECTIVE) : null;
      if (m && config.theme === undefined) {
        config.theme = m[1];
        config.themeLine = i;
      }
    });
  }
  return { config, title };
}

// Analyze lines
export function analyze(lines: Line[]): Doc {
  const participants: Participant[] = [];
  const byId = new Map<string, Participant>();
  const errors: ParseError[] = [];
  let title: string | undefined;
  let sawHeader = false;
  const blockStack: { kind: string; line: number }[] = [];

  const touch = (id: string) => {
    if (!byId.has(id)) {
      const p: Participant = { id, label: id, kind: 'participant' };
      byId.set(id, p);
      participants.push(p);
    }
    return byId.get(id)!;
  };

  lines.forEach(({ stmt: s }, i) => {
    if (s.type === 'blank' || s.type === 'comment' || s.type === 'frontmatter') return;
    if (!sawHeader) {
      sawHeader = true;
      if (s.type === 'header') return;
      errors.push({ line: i, message: 'Expected "sequenceDiagram" as the first statement' });
    }
    switch (s.type) {
      case 'header':
        errors.push({ line: i, message: 'Duplicate "sequenceDiagram" header' });
        break;
      case 'title':
        title = s.text;
        break;
      case 'participant': {
        const p = touch(s.id);
        p.kind = s.kind;
        p.label = s.alias ?? s.id;
        p.declLine = i;
        break;
      }
      case 'message':
        touch(s.from);
        touch(s.to);
        break;
      case 'note':
        s.actors.forEach(touch);
        if (s.placement !== 'over' && s.actors.length > 1)
          errors.push({ line: i, message: `"${s.placement}" takes a single participant` });
        break;
      case 'activate':
      case 'deactivate':
        touch(s.actor);
        break;
      case 'block':
        blockStack.push({ kind: s.kind, line: i });
        break;
      case 'branch': {
        const top = blockStack[blockStack.length - 1];
        const ok = { else: 'alt', and: 'par', option: 'critical' }[s.kind];
        if (!top || top.kind !== ok) errors.push({ line: i, message: `"${s.kind}" must be inside a "${ok}" block` });
        break;
      }
      case 'end':
        if (!blockStack.pop()) errors.push({ line: i, message: '"end" without a matching block' });
        break;
      case 'unknown':
        errors.push({ line: i, message: `Unrecognized statement: ${s.text}` });
        break;
    }
  });
  if (!sawHeader) errors.push({ line: 0, message: 'Missing "sequenceDiagram" header' });
  for (const b of blockStack) errors.push({ line: b.line, message: `"${b.kind}" block is never closed with "end"` });

  const { config, title: fmTitle } = readConfig(lines);
  return { lines, participants, title: title ?? fmTitle, config, errors };
}

export function parse(code: string): Doc {
  return analyze(parseLines(code));
}
