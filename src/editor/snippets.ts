// Snippets
import { snippet, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import { declarationOf, PARTICIPANT_SHAPES } from '../core/participants';
import type { FlowShape } from '../flow/model';
import { FLOW_SHAPES } from '../flow/shapes';
import { THEMES } from '../core/themes';
import { useStore } from '../state/store';
import type { Icons } from '../ui/icons';

export type SnippetGroup = 'Participants' | 'Messages' | 'Notes' | 'Fragments' | 'Nodes' | 'Links' | 'Structure' | 'Styling' | 'Other';

export interface Snippet {
  id: string;
  // Tile text
  label: string;
  // Autocomplete keyword
  keyword: string;
  detail: string;
  group: SnippetGroup;
  icon: keyof typeof Icons;
  // Flowchart shape icon
  shape?: FlowShape;
  // Template
  template: (a: string, b: string) => string;
}

const msg = (arrow: string, text: string) => (a: string, b: string) => `\${1:${a}}${arrow}\${2:${b}}: \${3:${text}}`;

const SNIPPETS: Snippet[] = [
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

const SNIPPET_GROUPS: SnippetGroup[] = ['Participants', 'Messages', 'Notes', 'Fragments', 'Other'];

const link = (arrow: string) => (a: string, b: string) => `\${1:${a}} ${arrow} \${2:${b}}`;

const FLOW_SNIPPETS: Snippet[] = [
  ...FLOW_SHAPES.map((d): Snippet => ({
    id: `node-${d.shape}`, group: 'Nodes', label: d.name, keyword: d.name.toLowerCase(), icon: 'participant', shape: d.shape, detail: d.hint,
    template: () => `\${1:id}${d.open}\${2:${d.defaultLabel}}${d.close}`,
  })),

  { id: 'link-arrow', group: 'Links', label: 'Arrow', keyword: 'arrow', icon: 'message', detail: 'A --> B', template: link('-->') },
  { id: 'link-label', group: 'Links', label: 'Labelled arrow', keyword: 'label', icon: 'message', detail: 'A -->|text| B', template: (a, b) => `\${1:${a}} -->|\${3:yes}| \${2:${b}}` },
  { id: 'link-open', group: 'Links', label: 'Line', keyword: 'line', icon: 'lineSolid', detail: 'No arrowhead  A --- B', template: link('---') },
  { id: 'link-dotted', group: 'Links', label: 'Dotted arrow', keyword: 'dotted', icon: 'arrowDotted', detail: 'A -.-> B', template: link('-.->') },
  { id: 'link-thick', group: 'Links', label: 'Thick arrow', keyword: 'thick', icon: 'message', detail: 'A ==> B', template: link('==>') },
  { id: 'link-both', group: 'Links', label: 'Both ways', keyword: 'both', icon: 'swap', detail: 'A <--> B', template: link('<-->') },
  { id: 'link-circle', group: 'Links', label: 'Circle end', keyword: 'circle end', icon: 'async', detail: 'A --o B', template: link('--o') },
  { id: 'link-cross', group: 'Links', label: 'Cross end', keyword: 'cross', icon: 'cross', detail: 'A --x B', template: link('--x') },
  { id: 'link-hidden', group: 'Links', label: 'Invisible', keyword: 'invisible', icon: 'lineDotted', detail: 'Layout only  A ~~~ B', template: link('~~~') },
  { id: 'link-chain', group: 'Links', label: 'Chain', keyword: 'chain', icon: 'message', detail: 'A --> B --> C', template: (a, b) => `\${1:${a}} --> \${2:${b}} --> \${3:C}` },

  { id: 'subgraph', group: 'Structure', label: 'Subgraph', keyword: 'subgraph', icon: 'subgraph', detail: 'Titled group', template: () => 'subgraph ${1:id} [${2:Title}]\n\t${}\nend' },
  { id: 'direction', group: 'Structure', label: 'Direction', keyword: 'direction', icon: 'swap', detail: 'TB, BT, LR or RL (inside a subgraph)', template: () => 'direction ${1:LR}' },

  { id: 'classDef', group: 'Styling', label: 'Class', keyword: 'classDef', icon: 'highlight', detail: 'Define a style class', template: () => 'classDef ${1:accent} fill:${2:#eef2ff},stroke:${3:#4f46e5}' },
  { id: 'class', group: 'Styling', label: 'Apply class', keyword: 'class', icon: 'highlight', detail: 'class A,B name', template: (a) => `class \${1:${a}} \${2:accent}` },
  { id: 'style', group: 'Styling', label: 'Style node', keyword: 'style', icon: 'highlight', detail: 'One node only', template: (a) => `style \${1:${a}} fill:\${2:#eef2ff},stroke:\${3:#4f46e5}` },
  { id: 'linkStyle', group: 'Styling', label: 'Style link', keyword: 'linkStyle', icon: 'lineSolid', detail: 'By link number, from 0', template: () => 'linkStyle ${1:0} stroke:${2:#4f46e5},stroke-width:2px' },
  { id: 'click', group: 'Other', label: 'Link to URL', keyword: 'click', icon: 'book', detail: 'Clickable node (in Mermaid)', template: (a) => `click \${1:${a}} "\${2:https://example.com}"` },
  { id: 'flow-comment', group: 'Other', label: 'Comment', keyword: 'comment', icon: 'comment', detail: 'Not drawn  %%', template: () => '%% ${1:comment}' },
];

const FLOW_SNIPPET_GROUPS: SnippetGroup[] = ['Nodes', 'Links', 'Structure', 'Styling', 'Other'];

const isFlow = () => useStore.getState().kind === 'flowchart';

// Snippets for the current diagram
export const currentSnippets = () => (isFlow() ? { snippets: FLOW_SNIPPETS, groups: FLOW_SNIPPET_GROUPS } : { snippets: SNIPPETS, groups: SNIPPET_GROUPS });

// Ids in this diagram
function diagramIds(): { id: string; label: string }[] {
  const s = useStore.getState();
  return s.flow ? s.flow.nodes.map((n) => ({ id: n.id, label: n.label })) : s.doc.participants.map((p) => ({ id: p.id, label: p.label }));
}

// Default names
function names(): [string, string] {
  const ids = diagramIds().map((p) => p.id);
  return isFlow() ? [ids[0] ?? 'A', ids[1] ?? 'B'] : [ids[0] ?? 'Alice', ids[1] ?? ids[0] ?? 'Bob'];
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
      options: Object.entries(THEMES).map(([id, t]) => ({ label: id, detail: t.name, type: 'enum' })),
      validFor: /^[\w-]*$/,
    };
  }
  if (word.from === word.to && !ctx.explicit) return null;
  const atLineStart = /^\s*$/.test(line.text.slice(0, word.from - line.from));
  const kindName = isFlow() ? 'node' : 'participant';
  // Skip half-typed word
  const participants: Completion[] = diagramIds()
    .filter((p) => p.id !== word.text)
    .map((p) => ({ label: p.id, type: 'variable', detail: p.label !== p.id ? p.label : kindName, boost: 1 }));
  if (!atLineStart) return { from: word.from, options: participants, validFor: /^[\w-]*$/ };
  const snippets: Completion[] = currentSnippets().snippets.map((s) => ({
    label: s.keyword,
    detail: s.detail,
    type: s.group === 'Fragments' || s.group === 'Other' || s.group === 'Structure' ? 'keyword' : 'function',
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
    const extra = /^\s*(loop|alt|opt|par|critical|break|rect|else|and|option|subgraph)\b/.test(line.text) ? '    ' : '';
    view.dispatch({ changes: { from: line.to, insert: `\n${indent}${extra}` }, selection: { anchor: line.to + 1 + indent.length + extra.length } });
  } else if (!line.text.length && line.number > 1) {
    // Match indent
    const indent = state.doc.line(line.number - 1).text.match(/^\s*/)![0];
    view.dispatch({ changes: { from: line.from, insert: indent }, selection: { anchor: line.from + indent.length } });
  }
  const pos = view.state.selection.main.head;
  apply(s)(view, null as never, pos, pos);
}
