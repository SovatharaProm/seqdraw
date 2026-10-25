// Snippets
import { snippet, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import { declarationOf, PARTICIPANT_SHAPES } from '../core/participants';
import { THEMES } from '../core/themes';
import { useStore } from '../state/store';
import type { Icons } from '../ui/icons';

export type SnippetGroup = 'Participants' | 'Messages' | 'Notes' | 'Fragments' | 'Other';

export interface Snippet {
  id: string;
  // Tile text
  label: string;
  // Autocomplete keyword
  keyword: string;
  detail: string;
  group: SnippetGroup;
  icon: keyof typeof Icons;
  // Template
  template: (a: string, b: string) => string;
}

const msg = (arrow: string, text: string) => (a: string, b: string) => `\${1:${a}}${arrow}\${2:${b}}: \${3:${text}}`;

export const SNIPPETS: Snippet[] = [
  ...PARTICIPANT_SHAPES.map((d): Snippet => {
    const { keyword, meta } = declarationOf(d.kind);
    return { id: d.kind, group: 'Participants', label: d.name, keyword: d.kind, icon: d.kind, detail: d.hint, template: () => `${keyword} \${1:Id}${meta} as \${2:Label}` };
  }),

  { id: 'arrow-solid', group: 'Messages', label: 'Solid arrow', keyword: 'request', icon: 'message', detail: 'Call  A->>B', template: msg('->>', 'request') },
  { id: 'arrow-dotted', group: 'Messages', label: 'Dotted arrow', keyword: 'reply', icon: 'arrowDotted', detail: 'Reply  A-->>B', template: (a, b) => msg('-->>', 'response')(b, a) },
  { id: 'line-solid', group: 'Messages', label: 'Solid line', keyword: 'line', icon: 'lineSolid', detail: 'No arrowhead  A->B', template: msg('->', 'message') },
  { id: 'line-dotted', group: 'Messages', label: 'Dotted line', keyword: 'dotted', icon: 'lineDotted', detail: 'No arrowhead  A-->B', template: msg('-->', 'message') },
  { id: 'async', group: 'Messages', label: 'Async', keyword: 'async', icon: 'async', detail: 'Fire and forget  A-)B', template: msg('-)', 'event') },
  { id: 'cross', group: 'Messages', label: 'Failed', keyword: 'fail', icon: 'cross', detail: 'Lost message  A-xB', template: msg('-x', 'error') },
  { id: 'self', group: 'Messages', label: 'Self call', keyword: 'self', icon: 'self', detail: 'A->>A', template: (a) => `\${1:${a}}->>\${1:${a}}: \${2:action}` },
  { id: 'roundtrip', group: 'Messages', label: 'Call + reply', keyword: 'roundtrip', icon: 'roundtrip', detail: 'With activation bar', template: (a, b) => `\${1:${a}}->>+\${2:${b}}: \${3:request}\n\${2:${b}}-->>-\${1:${a}}: \${4:response}` },

  { id: 'note-left', group: 'Notes', label: 'Note left of', keyword: 'note left', icon: 'noteLeft', detail: 'Note left of a lifeline', template: (a) => `Note left of \${1:${a}}: \${2:text}` },
  { id: 'note-over', group: 'Notes', label: 'Note over', keyword: 'note over', icon: 'noteOver', detail: 'Note spanning lifelines', template: (a, b) => `Note over \${1:${a}},\${2:${b}}: \${3:text}` },
  { id: 'note-right', group: 'Notes', label: 'Note right of', keyword: 'note right', icon: 'noteRight', detail: 'Note right of a lifeline', template: (a) => `Note right of \${1:${a}}: \${2:text}` },

  { id: 'loop', group: 'Fragments', label: 'Loop', keyword: 'loop', icon: 'loop', detail: 'Repeat block', template: () => 'loop ${1:Every minute}\n\t${}\nend' },
  { id: 'alt', group: 'Fragments', label: 'Alt / else', keyword: 'alt', icon: 'alt', detail: 'If / else block', template: () => 'alt ${1:Success}\n\t${}\nelse ${2:Failure}\n\t\nend' },
  { id: 'opt', group: 'Fragments', label: 'Optional', keyword: 'opt', icon: 'opt', detail: 'Optional block', template: () => 'opt ${1:Condition}\n\t${}\nend' },
  { id: 'par', group: 'Fragments', label: 'Parallel', keyword: 'par', icon: 'par', detail: 'Parallel block', template: () => 'par ${1:Task A}\n\t${}\nand ${2:Task B}\n\t\nend' },
  { id: 'critical', group: 'Fragments', label: 'Critical', keyword: 'critical', icon: 'critical', detail: 'Critical region', template: () => 'critical ${1:Action}\n\t${}\noption ${2:Fallback}\n\t\nend' },
  { id: 'break', group: 'Fragments', label: 'Break', keyword: 'break', icon: 'break', detail: 'Exit the flow', template: () => 'break ${1:When something fails}\n\t${}\nend' },
  { id: 'rect', group: 'Fragments', label: 'Highlight', keyword: 'rect', icon: 'highlight', detail: 'Colored background', template: () => 'rect ${1:rgb(191, 223, 255)}\n\t${}\nend' },

  { id: 'activate', group: 'Other', label: 'Activate', keyword: 'activate', icon: 'activate', detail: 'Start an activation bar', template: (a) => `activate \${1:${a}}` },
  { id: 'deactivate', group: 'Other', label: 'Deactivate', keyword: 'deactivate', icon: 'deactivate', detail: 'End an activation bar', template: (a) => `deactivate \${1:${a}}` },
  { id: 'autonumber', group: 'Other', label: 'Autonumber', keyword: 'autonumber', icon: 'numbers', detail: 'Number every message', template: () => 'autonumber' },
  { id: 'title', group: 'Other', label: 'Title', keyword: 'title', icon: 'title', detail: 'Diagram title', template: () => 'title ${1:Title}' },
  { id: 'comment', group: 'Other', label: 'Comment', keyword: 'comment', icon: 'comment', detail: 'Not drawn  %%', template: () => '%% ${1:comment}' },
];

export const SNIPPET_GROUPS: SnippetGroup[] = ['Participants', 'Messages', 'Notes', 'Fragments', 'Other'];

// Default names
function names(): [string, string] {
  const ids = useStore.getState().doc.participants.map((p) => p.id);
  return [ids[0] ?? 'Alice', ids[1] ?? ids[0] ?? 'Bob'];
}

const apply = (s: Snippet) => snippet(s.template(...names()));

// Autocomplete
export function completeMermaid(ctx: CompletionContext): CompletionResult | null {
  const word = ctx.matchBefore(/[\w-]*/);
  if (!word) return null;
  const line = ctx.state.doc.lineAt(ctx.pos);
  // Theme names
  if (/^\s*theme\s*:\s*$/.test(line.text.slice(0, word.from - line.from))) {
    return {
      from: word.from,
      options: Object.entries(THEMES).map(([id, t]) => ({ label: id, detail: `${t.group}${t.dark ? ' · dark' : ''}`, type: 'enum' })),
      validFor: /^[\w-]*$/,
    };
  }
  if (word.from === word.to && !ctx.explicit) return null;
  const atLineStart = /^\s*$/.test(line.text.slice(0, word.from - line.from));
  const participants: Completion[] = useStore
    .getState()
    .doc.participants // skip half-typed word
    .filter((p) => p.id !== word.text)
    .map((p) => ({ label: p.id, type: 'variable', detail: p.label !== p.id ? p.label : 'participant', boost: 1 }));
  if (!atLineStart) return { from: word.from, options: participants, validFor: /^[\w-]*$/ };
  const snippets: Completion[] = SNIPPETS.map((s) => ({
    label: s.keyword,
    detail: s.detail,
    type: s.group === 'Fragments' || s.group === 'Other' ? 'keyword' : 'function',
    section: s.group,
    apply: (view, completion, from, to) => apply(s)(view, completion, from, to),
  }));
  return { from: word.from, options: [...snippets, ...participants.map((p) => ({ ...p, section: 'In this diagram' }))], validFor: /^[\w-]*$/ };
}

// Insert snippet
export function insertSnippet(view: EditorView, s: Snippet) {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  view.focus();
  if (line.text.trim()) {
    const indent = line.text.match(/^\s*/)![0];
    const extra = /^\s*(loop|alt|opt|par|critical|break|rect|else|and|option)\b/.test(line.text) ? '    ' : '';
    view.dispatch({ changes: { from: line.to, insert: `\n${indent}${extra}` }, selection: { anchor: line.to + 1 + indent.length + extra.length } });
  } else if (!line.text.length && line.number > 1) {
    // Match indent
    const indent = state.doc.line(line.number - 1).text.match(/^\s*/)![0];
    view.dispatch({ changes: { from: line.from, insert: indent }, selection: { anchor: line.from + indent.length } });
  }
  const pos = view.state.selection.main.head;
  apply(s)(view, null as never, pos, pos);
}
