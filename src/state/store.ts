import { create } from 'zustand';
import { readBool, writeBool } from '../lib/storage';
import { detectKind, type DiagramKind } from '../core/diagram';
import { layoutDiagram, type Layout } from '../core/layout';
import { emptyOverrides, type Doc, type LayoutOverrides, type Line } from '../core/model';
import { measureFor } from '../core/measure';
import { setConfigTheme } from '../core/ops';
import { parse } from '../core/parser';
import { serialize } from '../core/serializer';
import { LEGACY_THEMES, THEMES, resolveTheme } from '../core/themes';
import { layoutFlow, type FlowLayout } from '../flow/layout';
import type { FlowDoc, FlowLine } from '../flow/model';
import { parseFlow } from '../flow/parser';
import { serializeFlow } from '../flow/serializer';
import { EXAMPLES } from '../ui/examples';

// Flowchart selection
export type FlowSelection = { kind: 'node'; id: string } | { kind: 'subgraph'; id: string } | { kind: 'edge'; index: number; line: number };

export type Selection =
  | { kind: 'participant'; id: string }
  | { kind: 'message' | 'note' | 'frame'; line: number }
  | FlowSelection;

// Edit target
export type EditTarget = { kind: 'participant'; id: string } | { kind: 'message' | 'note' | 'frame' | 'branch'; line: number } | FlowSelection;

// Selection -> edit target
export const editTargetOf = (sel: Selection): EditTarget => sel;

interface Snapshot {
  code: string;
  overrides: LayoutOverrides;
}

export interface ProjectData {
  code: string;
  overrides: LayoutOverrides;
  theme: string;
}

interface State {
  code: string;
  overrides: LayoutOverrides;
  theme: string;
  kind: DiagramKind;
  doc: Doc;
  layout: Layout;
  // Flowchart (null for sequence diagrams)
  flow: FlowDoc | null;
  flowLayout: FlowLayout | null;
  selection: Selection | null;
  // Selection source
  selectionSource: 'canvas' | 'editor';
  editing: EditTarget | null;
  fileName: string;
  dirty: boolean;
  past: Snapshot[];
  future: Snapshot[];
  // Auto-update off: typed code waiting to render
  autoUpdate: boolean;
  pending: string | null;

  setCode(code: string): void;
  typeCode(code: string): void;
  flush(): void;
  setAutoUpdate(on: boolean): void;
  commit(lines: Line[] | FlowLine[], opts?: { select?: Selection | null; overrides?: LayoutOverrides; edit?: EditTarget }): void;
  setOverrides(overrides: LayoutOverrides): void;
  setTheme(theme: string): void;
  select(sel: Selection | null, source?: 'canvas' | 'editor'): void;
  setEditing(target: EditTarget | null): void;
  undo(): void;
  redo(): void;
  load(data: ProjectData, fileName: string): void;
  setFileName(name: string): void;
  markSaved(): void;
}

// Flowchart line -> selection
export function flowSelectionForLine(flow: FlowDoc, line: number): Selection | null {
  const edge = flow.edges.find((e) => e.line === line);
  if (edge) return { kind: 'edge', index: edge.index, line };
  const node = flow.nodes.find((n) => n.declLine === line) ?? flow.nodes.find((n) => n.firstLine === line);
  if (node) return { kind: 'node', id: node.id };
  const sg = flow.subgraphs.find((s) => s.line === line || s.endLine === line);
  return sg ? { kind: 'subgraph', id: sg.id } : null;
}

// Selected line range (0-based)
export function selectionRange(s: { doc: Doc; flow: FlowDoc | null }, sel: Selection): [number, number] {
  if (s.flow) {
    const f = s.flow;
    if (sel.kind === 'edge') return [sel.line, sel.line];
    if (sel.kind === 'subgraph') {
      const sg = f.subgraphs.find((x) => x.id === sel.id);
      return sg ? [sg.line, Math.max(sg.line, sg.endLine)] : [-1, -1];
    }
    if (sel.kind === 'node') {
      const n = f.nodes.find((x) => x.id === sel.id);
      const l = n ? (n.declLine ?? n.firstLine) : -1;
      return [l, l];
    }
    return [-1, -1];
  }
  const line = selectionLine(s.doc, sel);
  if (sel.kind === 'frame' && line >= 0) {
    // Block end
    let depth = 0;
    for (let i = line; i < s.doc.lines.length; i++) {
      const t = s.doc.lines[i].stmt.type;
      if (t === 'block') depth++;
      else if (t === 'end' && --depth === 0) return [line, i];
    }
  }
  return [line, line];
}

// Line -> selection (either kind)
export function lineSelection(s: { doc: Doc; flow: FlowDoc | null }, line: number): Selection | null {
  return s.flow ? flowSelectionForLine(s.flow, line) : selectionForLine(s.doc, line);
}

// Line -> selection
export function selectionForLine(doc: Doc, line: number): Selection | null {
  const s = doc.lines[line]?.stmt;
  if (!s) return null;
  if (s.type === 'message' || s.type === 'note') return { kind: s.type, line };
  if (s.type === 'participant') return { kind: 'participant', id: s.id };
  if (s.type === 'block') return { kind: 'frame', line };
  if (s.type === 'branch' || s.type === 'end') {
    // Find owning block
    let depth = 0;
    for (let i = line - 1; i >= 0; i--) {
      const t = doc.lines[i].stmt.type;
      if (t === 'end') depth++;
      else if (t === 'block' && depth-- === 0) return { kind: 'frame', line: i };
    }
  }
  return null;
}

// Selection -> line
export function selectionLine(doc: Doc, sel: Selection): number {
  if (sel.kind === 'node' || sel.kind === 'subgraph') return -1;
  if (sel.kind !== 'participant') return sel.line;
  const p = doc.participants.find((x) => x.id === sel.id);
  if (!p) return -1;
  if (p.declLine !== undefined) return p.declLine;
  return doc.lines.findIndex(({ stmt: s }) => (s.type === 'message' && (s.from === p.id || s.to === p.id)) || (s.type === 'note' && s.actors.includes(p.id)));
}

const HISTORY_LIMIT = 200;
const COALESCE_MS = 800;
let lastTyping = 0;

// Derive doc, theme, layout
function derive(code: string, overrides: LayoutOverrides) {
  const kind = detectKind(code);
  if (kind === 'flowchart') {
    const flow = parseFlow(code);
    const theme = resolveTheme(flow.config.theme);
    const t = THEMES[theme];
    // Empty sequence doc
    const doc: Doc = { lines: [], participants: [], config: flow.config, errors: flow.errors, title: flow.title };
    const measure = measureFor(t.fontFamily, t.labelWeight, t.upperLabels);
    return { kind, doc, theme, flow, layout: layoutDiagram(doc, overrides, measure), flowLayout: layoutFlow(flow, overrides.nodes ?? {}, measure, overrides.ports ?? {}) };
  }
  const doc = parse(code);
  const theme = resolveTheme(doc.config.theme);
  const t = THEMES[theme];
  return { kind, doc, theme, flow: null, flowLayout: null, layout: layoutDiagram(doc, overrides, measureFor(t.fontFamily, t.labelWeight, t.upperLabels)) };
}

// Legacy theme
function withLegacyTheme(code: string, theme: string | undefined): string {
  if (detectKind(code) === 'flowchart') return code;
  const legacy = theme ? LEGACY_THEMES[theme] : undefined;
  const doc = parse(code);
  return legacy && doc.config.theme === undefined ? serialize(setConfigTheme(doc, legacy)) : code;
}

const initial = EXAMPLES[0].code;

export const useStore = create<State>((set, get) => {
  // Push history
  const pushHistory = (coalesce = false) => {
    const { code, overrides, past } = get();
    const now = Date.now();
    if (coalesce && now - lastTyping < COALESCE_MS && past.length) {
      lastTyping = now;
      return;
    }
    lastTyping = coalesce ? now : 0;
    set({ past: [...past, { code, overrides }].slice(-HISTORY_LIMIT), future: [] });
  };

  const apply = (code: string, overrides: LayoutOverrides, extra: Partial<State> = {}) =>
    set({ code, overrides, ...derive(code, overrides), dirty: true, ...extra });

  return {
    code: initial,
    overrides: emptyOverrides(),
    ...derive(initial, emptyOverrides()),
    selection: null,
    selectionSource: 'canvas',
    editing: null,
    fileName: 'untitled',
    dirty: false,
    past: [],
    future: [],
    autoUpdate: readBool('autoUpdate', true),
    pending: null,

    // Typed code
    typeCode(code) {
      if (get().autoUpdate) get().setCode(code);
      else set({ pending: code === get().code ? null : code, dirty: true });
    },

    // Render pending code
    flush() {
      const { pending } = get();
      if (pending === null) return;
      set({ pending: null });
      get().setCode(pending);
    },

    setAutoUpdate(autoUpdate) {
      set({ autoUpdate });
      writeBool('autoUpdate', autoUpdate);
      if (autoUpdate) get().flush();
    },

    setCode(code) {
      if (code === get().code) return;
      pushHistory(true);
      apply(code, get().overrides);
    },

    commit(lines, opts = {}) {
      pushHistory();
      const code = get().flow ? serializeFlow(lines as FlowLine[]) : serialize(lines as Line[]);
      const overrides = opts.overrides ?? get().overrides;
      apply(code, overrides, {
        ...(opts.select !== undefined ? { selection: opts.select, selectionSource: 'canvas' as const } : {}),
        ...(opts.edit ? { editing: opts.edit } : {}),
      });
    },

    setOverrides(overrides) {
      pushHistory();
      apply(get().code, overrides);
    },

    // Set theme
    setTheme(theme) {
      if (theme === get().theme) return;
      const { flow, doc } = get();
      get().commit(flow ? setConfigTheme(flow, theme) : setConfigTheme(doc, theme));
    },

    select(selection, source = 'canvas') {
      set({ selection, selectionSource: source });
    },

    setEditing(editing) {
      set({ editing });
    },

    undo() {
      get().flush();
      const { past, future, code, overrides } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      lastTyping = 0;
      set({ past: past.slice(0, -1), future: [{ code, overrides }, ...future], selection: null, editing: null });
      apply(prev.code, prev.overrides);
    },

    redo() {
      get().flush();
      const { past, future, code, overrides } = get();
      const next = future[0];
      if (!next) return;
      lastTyping = 0;
      set({ past: [...past, { code, overrides }], future: future.slice(1), selection: null, editing: null });
      apply(next.code, next.overrides);
    },

    load(data, fileName) {
      lastTyping = 0;
      const code = withLegacyTheme(data.code, data.theme);
      set({
        code,
        overrides: data.overrides,
        ...derive(code, data.overrides),
        fileName,
        dirty: false,
        pending: null,
        past: [],
        future: [],
        selection: null,
        editing: null,
      });
    },

    setFileName(fileName) {
      set({ fileName });
    },

    markSaved() {
      set({ dirty: false });
    },
  };
});

// State with pending code rendered first (for actions)
export function current(): State {
  useStore.getState().flush();
  return useStore.getState();
}
