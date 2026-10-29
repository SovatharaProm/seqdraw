// Inline text editor over the canvas
import { useEffect, useRef, useState } from 'react';
import { type Layout } from '../core/layout';
import { FONT_SIZE, LINE_HEIGHT } from '../core/measure';
import { shapeOf } from '../core/participants';
import type { FlowLayout } from '../flow/layout';
import * as actions from '../state/actions';
import { useStore, type EditTarget } from '../state/store';
import type { View } from './types';

type Box = { x: number; y: number; w: number; h: number; multiline: boolean; bare?: boolean };

// Flowchart editor box
function flowEditBox(L: FlowLayout, t: EditTarget): Box | null | undefined {
  if (t.kind === 'node') {
    const n = L.nodes.find((q) => q.id === t.id);
    if (!n) return null;
    // Type on the shape
    const w = Math.max(n.width - 8, 48);
    const h = Math.max(1, n.label.length) * LINE_HEIGHT;
    return { x: n.x - w / 2, y: n.y - h / 2, w, h, multiline: true, bare: true };
  }
  if (t.kind === 'edge') {
    const e = L.edges.find((q) => q.index === t.index);
    if (!e || !e.points.length) return null;
    const mid = e.labelBox ? { x: e.labelBox.x + e.labelBox.width / 2, y: e.labelBox.y + e.labelBox.height / 2 } : e.points[Math.floor(e.points.length / 2)];
    const h = Math.max(28, e.label.length * LINE_HEIGHT + 8);
    return { x: mid.x - 80, y: mid.y - h / 2, w: 160, h, multiline: true };
  }
  if (t.kind === 'subgraph') {
    const c = L.clusters.find((q) => q.id === t.id);
    return c && { x: c.x + Math.min(0, (c.width - 160) / 2), y: c.y + 2, w: Math.max(c.width, 160), h: 28, multiline: false };
  }
  return null;
}

// Label colour of the edited node
export function inkOf(L: FlowLayout | null, t: EditTarget, fallback: string): string {
  return (t.kind === 'node' && L?.nodes.find((q) => q.id === t.id)?.style.color) || fallback;
}

// Inline editor box
function editBox(layout: Layout, t: EditTarget, flow: FlowLayout | null): Box | null | undefined {
  if (flow) return flowEditBox(flow, t);
  if (t.kind === 'node' || t.kind === 'edge' || t.kind === 'subgraph') return null;
  if (t.kind === 'participant') {
    const p = layout.participants.find((q) => q.id === t.id);
    return p && { x: p.x - p.width / 2, y: p.top + (shapeOf(p.kind).icon ? p.height - LINE_HEIGHT - 4 : (p.height - 28) / 2), w: p.width, h: 28, multiline: false };
  }
  if (t.kind === 'message') {
    const m = layout.messages.find((q) => q.line === t.line);
    if (!m) return null;
    const cx = (m.x1 + m.x2) / 2;
    const w = Math.max(160, Math.abs(m.x2 - m.x1) - 20);
    return { x: cx - w / 2, y: m.textY - 4, w, h: Math.max(28, m.text.length * LINE_HEIGHT + 8), multiline: true };
  }
  if (t.kind === 'note') {
    const n = layout.notes.find((q) => q.line === t.line);
    return n && { x: n.x, y: n.y, w: Math.max(n.width, 140), h: Math.max(n.height, 36), multiline: true };
  }
  if (t.kind === 'frame') {
    const f = layout.frames.find((q) => q.line === t.line);
    return f && { x: f.x1 + 50, y: f.y1 - 4, w: Math.max(160, f.x2 - f.x1 - 60), h: 28, multiline: false };
  }
  for (const f of layout.frames) {
    const s = f.sections.find((q) => q.line === t.line);
    if (s) return { x: (f.x1 + f.x2) / 2 - 90, y: s.y - 2, w: 180, h: 28, multiline: false };
  }
  return null;
}

export function InlineEditor({ target, layout, flow, view, fontFamily, ink }: { target: EditTarget; layout: Layout; flow: FlowLayout | null; view: View; fontFamily: string; ink: string }) {
  const [value, setValue] = useState(() => actions.editText(target));
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const b = editBox(layout, target, flow);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  if (!b) return null;
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    useStore.getState().setEditing(null);
    if (save && value !== actions.editText(target)) actions.setText(target, value);
  };
  const rows = Math.max(1, value.split('\n').length);
  const lift = b.bare ? ((rows - Math.max(1, b.h / LINE_HEIGHT)) * LINE_HEIGHT) / 2 : 0;

  return (
    <>
    {b.bare && target.kind === 'node' && <style>{`.diagram-main [data-kind="node"][data-id="${CSS.escape(target.id)}"] text { visibility: hidden; }`}</style>}
    <textarea
      ref={ref}
      className={`inline-editor${b.bare ? ' bare' : ''}`}
      value={value}
      rows={rows}
      spellCheck={false}
      placeholder={target.kind === 'message' ? 'Message text' : ''}
      style={{
        left: b.x * view.k + view.x,
        top: (b.y - lift) * view.k + view.y,
        width: b.w * view.k,
        minHeight: b.h * view.k,
        fontSize: FONT_SIZE * view.k,
        fontFamily,
        lineHeight: `${LINE_HEIGHT * view.k}px`,
        ...(b.bare ? { color: ink } : {}),
      }}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') finish(false);
        else if (e.key === 'Enter' && (!e.shiftKey || !b.multiline)) {
          e.preventDefault();
          finish(true);
        }
      }}
    />
    </>
  );
}
