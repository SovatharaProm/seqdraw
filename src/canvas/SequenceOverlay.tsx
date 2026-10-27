// Sequence diagram canvas overlays
import { dropLine, nearestParticipant, type Layout } from '../core/layout';
import { FONT_FAMILY, FONT_SIZE } from '../core/measure';
import type { Theme } from '../core/themes';
import { selfPath, StatementShape } from '../render/DiagramSvg';
import * as actions from '../state/actions';
import type { Selection } from '../state/store';
import type { Drag } from './types';

export function SelectionOverlay({ layout, selection, k }: { layout: Layout; selection: Selection | null; k: number }) {
  if (!selection || selection.kind === 'node' || selection.kind === 'edge' || selection.kind === 'subgraph') return null;
  const pad = 4;
  const sw = 2 / k;
  const style = { fill: 'none', stroke: 'var(--accent)', strokeWidth: sw, pointerEvents: 'none' as const };
  if (selection.kind === 'participant') {
    const p = layout.participants.find((q) => q.id === selection.id);
    if (!p) return null;
    const x = p.x - p.width / 2;
    const hs = 10 / k;
    return (
      <g>
        <rect x={x - pad} y={p.top - pad} width={p.width + pad * 2} height={p.height + pad * 2} rx={4} {...style} />
        <rect x={x - pad} y={p.bottom - pad} width={p.width + pad * 2} height={p.height + pad * 2} rx={4} {...style} />
        <rect data-handle="resize" x={x + p.width - hs / 2} y={p.top + p.height - hs / 2} width={hs} height={hs} fill="white" stroke="var(--accent)" strokeWidth={sw} style={{ cursor: 'nwse-resize' }}>
          <title>Drag to resize</title>
        </rect>
      </g>
    );
  }
  if (selection.kind === 'message') {
    const m = layout.messages.find((q) => q.line === selection.line);
    if (!m) return null;
    const endY = m.self ? m.y + 28 : m.y;
    const d = m.self ? selfPath(m.x1, m.y, m.x2) : `M${m.x1} ${m.y} H${m.x2}`;
    const r = 6 / k;
    return (
      <g>
        <path d={d} {...style} strokeWidth={4 / k} opacity={0.35} />
        <circle data-handle="from" cx={m.x1} cy={m.y} r={r} fill="white" stroke="var(--accent)" strokeWidth={sw} style={{ cursor: 'move' }}>
          <title>Drag to another lifeline to change the sender</title>
        </circle>
        <circle data-handle="to" cx={m.x2} cy={endY} r={r} fill="var(--accent)" stroke="white" strokeWidth={sw} style={{ cursor: 'move' }}>
          <title>Drag to another lifeline to change the receiver</title>
        </circle>
      </g>
    );
  }
  if (selection.kind === 'note') {
    const n = layout.notes.find((q) => q.line === selection.line);
    return n ? <rect x={n.x - pad} y={n.y - pad} width={n.width + pad * 2} height={n.height + pad * 2} rx={3} {...style} /> : null;
  }
  const f = layout.frames.find((q) => q.line === selection.line);
  return f ? <rect x={f.x1 - pad} y={f.y1 - pad} width={f.x2 - f.x1 + pad * 2} height={f.y2 - f.y1 + pad * 2} rx={3} {...style} strokeDasharray={`${6 / k} ${4 / k}`} /> : null;
}

export function DragOverlay({ drag: d, layout, theme, k, end }: { drag: Drag; layout: Layout; theme: Theme; k: number; end: number }) {
  const accent = 'var(--accent)';
  const sw = 2 / k;
  const none = { pointerEvents: 'none' as const };
  if (d.type === 'participant' && d.moved) {
    const p = layout.participants.find((q) => q.id === d.id)!;
    const x = d.origX + d.dx;
    return (
      <g style={none} opacity={0.75}>
        <rect x={x - p.width / 2} y={p.top} width={p.width} height={p.height} rx={3} fill="var(--accent-soft)" stroke={accent} strokeWidth={sw} strokeDasharray={`${6 / k} ${4 / k}`} />
        <line x1={x} x2={x} y1={p.top + p.height} y2={p.bottom} stroke={accent} strokeWidth={sw} strokeDasharray={`${4 / k} ${4 / k}`} />
        <text x={x} y={p.top + p.height / 2 + 5} textAnchor="middle" fontFamily={FONT_FAMILY} fontSize={FONT_SIZE} fill="var(--text)">{p.label}</text>
      </g>
    );
  }
  if (d.type === 'statement' && d.moved) {
    const target = dropLine(layout, d.y, end);
    const slot = layout.slots.find((s) => s.line === target);
    const y = slot ? slot.y1 : layout.lifelineBottom - 10;
    const x1 = layout.bounds.x + 10;
    const x2 = layout.bounds.x + layout.bounds.width - 10;
    const block = layout.frames.some((f) => f.line === d.line);
    const gx = block ? 0 : (actions.horizontalShift(d.line, d.x - d.start.x)?.dx ?? 0);
    return (
      <g style={none}>
        <g transform={`translate(${gx} ${d.y - d.start.y})`} opacity={0.85}>
          <StatementShape layout={layout} line={d.line} theme={theme} />
        </g>
        <line x1={x1} x2={x2} y1={y} y2={y} stroke={accent} strokeWidth={3 / k} />
        <circle cx={x1} cy={y} r={5 / k} fill={accent} />
        <line x1={x1} x2={x2} y1={d.y} y2={d.y} stroke={accent} strokeWidth={1 / k} strokeDasharray={`${4 / k} ${4 / k}`} opacity={0.6} />
      </g>
    );
  }
  if (d.type === 'resize') {
    const p = layout.participants.find((q) => q.id === d.id)!;
    const w = Math.max(40, d.w + d.dw);
    const h = Math.max(30, d.h + d.dh);
    return <rect style={none} x={p.x - w / 2} y={p.top} width={w} height={h} fill="none" stroke={accent} strokeWidth={sw} strokeDasharray={`${6 / k} ${4 / k}`} />;
  }
  if (d.type === 'connect' || d.type === 'reconnect') {
    let from: { x: number; y: number };
    if (d.type === 'connect') from = d.start;
    else {
      const m = layout.messages.find((q) => q.line === d.line)!;
      from = d.end === 'to' ? { x: m.x1, y: m.y } : { x: m.x2, y: m.y };
    }
    const tgt = nearestParticipant(layout, d.to.x);
    const snap = tgt && Math.abs(tgt.x - d.to.x) < 60 ? tgt : null;
    const toX = snap ? snap.x : d.to.x;
    const toY = d.type === 'connect' ? from.y : d.to.y;
    return (
      <g style={none}>
        {snap && <line x1={snap.x} x2={snap.x} y1={layout.lifelineTop} y2={layout.lifelineBottom} stroke={accent} strokeWidth={4 / k} opacity={0.25} />}
        <line x1={from.x} y1={from.y} x2={toX} y2={toY} stroke={accent} strokeWidth={sw} strokeDasharray={`${6 / k} ${4 / k}`} />
        <circle cx={toX} cy={toY} r={5 / k} fill={accent} />
      </g>
    );
  }
  return null;
}
