import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, StreamLanguage, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { linter, lintGutter } from '@codemirror/lint';
import { Annotation, EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, drawSelection, highlightActiveLine, keymap, lineNumbers, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';
import { findBlockEnd } from '../core/ops';
import { selectionForLine, selectionLine, useStore } from '../state/store';
import { completeMermaid } from './snippets';

// Active editor
let activeView: EditorView | null = null;
export const getEditorView = () => activeView;

// External change
const External = Annotation.define<boolean>();

const KEYWORDS = /^(participant|actor|as|loop|alt|else|opt|par|and|critical|option|break|rect|end|activate|deactivate|autonumber|title|off)\b/;

// Mermaid tokenizer
const mermaidSequence = StreamLanguage.define<{ afterColon: boolean; fm: 0 | 1 | 2 }>({
  startState: () => ({ afterColon: false, fm: 0 }),
  token(stream, state) {
    if (stream.sol()) {
      state.afterColon = false;
      if (state.fm !== 2 && stream.match(/^---\s*$/)) {
        state.fm = state.fm === 0 ? 1 : 2;
        return 'meta';
      }
      if (state.fm === 0) state.fm = 2;
    }
    if (state.fm === 1) {
      if (stream.eatSpace()) return null;
      if (stream.match(/^[\w-]+(?=\s*:)/)) return 'propertyName';
      if (stream.eat(':')) return 'punctuation';
      stream.skipToEnd();
      return 'string';
    }
    if (state.afterColon) {
      stream.skipToEnd();
      return 'string';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('%%')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^sequenceDiagram\b/)) return 'heading';
    if (stream.match(/^[Nn]ote\b/) || stream.match(/^(left of|right of|over)\b/)) return 'keyword';
    if (stream.match(KEYWORDS)) return 'keyword';
    if (stream.match(/^(<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))[+-]?/)) return 'operator';
    if (stream.match(/^@\{[^}]*\}/)) return 'meta';
    if (stream.eat(':')) {
      state.afterColon = true;
      return 'punctuation';
    }
    if (stream.match(/^[^\s\-<>:,;+]+/)) return 'variableName';
    stream.next();
    return null;
  },
});

const highlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--code-header)', fontWeight: '600' },
  { tag: tags.keyword, color: 'var(--code-keyword)', fontWeight: '500' },
  { tag: tags.operator, color: 'var(--code-operator)' },
  { tag: tags.string, color: 'var(--code-string)' },
  { tag: tags.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: tags.variableName, color: 'var(--code-name)' },
  { tag: tags.meta, color: 'var(--code-meta)' },
  { tag: tags.propertyName, color: 'var(--code-property)' },
  { tag: tags.punctuation, color: 'var(--muted)' },
]);

// Indent guides
const indentMark = Decoration.mark({ class: 'cm-indent' });
function indentGuides(view: EditorView): DecorationSet {
  const marks = [];
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const lead = line.text.match(/^ +/)?.[0].length ?? 0;
      if (lead >= 4 && line.text.trim()) marks.push(indentMark.range(line.from, line.from + lead - (lead % 4)));
      pos = line.to + 1;
    }
  }
  return Decoration.set(marks);
}
const indentPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = indentGuides(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = indentGuides(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

// Linked line highlight
const setLinked = StateEffect.define<{ from: number; to: number } | null>();
const linkedLines = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setLinked)) continue;
      if (!e.value) return Decoration.none;
      const marks = [];
      for (let n = e.value.from; n <= e.value.to; n++) {
        if (n < 1 || n > tr.state.doc.lines) continue;
        marks.push(Decoration.line({ class: 'cm-linked' }).range(tr.state.doc.line(n).from));
      }
      deco = Decoration.set(marks);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'var(--panel)', color: 'var(--text)' },
  // No ligatures
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65', fontVariantLigatures: 'none' },
  '.cm-gutters': { backgroundColor: 'var(--panel)', color: 'var(--muted)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--hover)' },
  '.cm-linked': { backgroundColor: 'var(--accent-soft)' },
  '.cm-indent': { backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px)', backgroundSize: '4ch 100%', backgroundPosition: '0.4ch 0' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--text)' },
  '.cm-tooltip': { backgroundColor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '6px', boxShadow: 'var(--shadow)', overflow: 'hidden' },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'inherit', maxHeight: '18em' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '3px 10px !important' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--text)' },
  '.cm-completionDetail': { color: 'var(--muted)', fontStyle: 'normal', marginLeft: '12px' },
  '.cm-completionSection': { fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', padding: '6px 10px 2px !important', borderBottom: 'none !important' },
  '.cm-completionMatchedText': { textDecoration: 'none', color: 'var(--accent)', fontWeight: '600' },
  '.cm-snippetField': { backgroundColor: 'var(--accent-soft)', borderRadius: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--accent-soft) !important' },
});

export function CodeEditor() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const store = useStore.getState;
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: store().code,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          drawSelection(),
          EditorState.tabSize.of(4),
          indentUnit.of('    '),
          // Linked fields
          EditorState.allowMultipleSelections.of(true),
          autocompletion({ override: [completeMermaid], icons: false }),
          keymap.of([{ key: 'Mod-Enter', run: () => (store().flush(), true) }, ...completionKeymap, ...defaultKeymap, indentWithTab]),
          indentPlugin,
          mermaidSequence,
          syntaxHighlighting(highlight),
          lintGutter(),
          linter(
            (v) =>
              store().doc.errors
                .filter((e) => e.line < v.state.doc.lines)
                .map((e) => {
                  const line = v.state.doc.line(e.line + 1);
                  return { from: line.from, to: line.to, severity: 'error' as const, message: `Syntax error: ${e.message}` };
                }),
            { delay: 250 },
          ),
          linkedLines,
          editorTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            const external = u.transactions.some((t) => t.annotation(External));
            if (u.docChanged && !external) store().typeCode(u.state.doc.toString());
            if (u.selectionSet && !external && u.view.hasFocus) {
              const line = u.state.doc.lineAt(u.state.selection.main.head).number - 1;
              store().select(selectionForLine(store().doc, line), 'editor');
            }
          }),
        ],
      }),
    });

    activeView = view;

    // Store -> editor sync
    const unsubCode = useStore.subscribe((s, prev) => {
      if (s.code === prev.code) return;
      const cur = view.state.doc.toString();
      if (cur === s.code) return;
      let start = 0;
      while (start < cur.length && start < s.code.length && cur[start] === s.code[start]) start++;
      let endA = cur.length;
      let endB = s.code.length;
      while (endA > start && endB > start && cur[endA - 1] === s.code[endB - 1]) endA--, endB--;
      view.dispatch({ changes: { from: start, to: endA, insert: s.code.slice(start, endB) }, annotations: External.of(true) });
    });

    // Selection -> editor
    const unsubSel = useStore.subscribe((s, prev) => {
      if (s.selection === prev.selection && s.code === prev.code) return;
      const line = s.selection ? selectionLine(s.doc, s.selection) : -1;
      if (line < 0) return view.dispatch({ effects: setLinked.of(null), annotations: External.of(true) });
      let to = line;
      if (s.selection?.kind === 'frame') to = Math.max(line, findBlockEnd(s.doc.lines, line));
      const effects = [setLinked.of({ from: line + 1, to: to + 1 })];
      if (s.selectionSource === 'canvas' && s.selection !== prev.selection && line < view.state.doc.lines)
        effects.push(EditorView.scrollIntoView(view.state.doc.line(line + 1).from, { y: 'center' }) as never);
      view.dispatch({ effects, annotations: External.of(true) });
    });

    return () => {
      unsubCode();
      unsubSel();
      if (activeView === view) activeView = null;
      view.destroy();
    };
  }, []);

  return <div className="code-editor" ref={host} />;
}
