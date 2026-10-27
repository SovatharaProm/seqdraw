// Box selection and multi-selection outlines
import type { Layout } from '../core/layout';
import type { FlowLayout } from '../flow/layout';
import { edgePath } from '../render/FlowSvg';
import type { Selection } from '../state/store';
import { rectOf } from './marquee';
import type { Pt } from './types';

const none = { pointerEvents: 'none' as const };

export function MarqueeBox({ start, to, k }: { start: Pt; to: Pt; k: number }) {
  const r = rectOf(start, to);
  return <rect style={none} x={r.x1} y={r.y1} width={r.x2 - r.x1} height={r.y2 - r.y1} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1 / k} strokeDasharray={`${4 / k} ${3 / k}`} />;
}

// Outline every selected item
export function GroupOutline({ items, layout, flow, k }: { items: Selection[]; layout: Layout; flow: FlowLayout | null; k: number }) {
  const pad = 4;
  const style = { ...none, fill: 'none', stroke: 'var(--accent)', strokeWidth: 2 / k };
  const box = (x: number, y: number, w: number, h: number, key: string) => <rect key={key} x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} rx={4} {...style} />;
  return (
    <g>
      {items.map((it) => {
        const key = JSON.stringify(it);
        if (flow && it.kind === 'node') {
          const n = flow.nodes.find((q) => q.id === it.id);
          return n && box(n.x - n.width / 2, n.y - n.height / 2, n.width, n.height, key);
        }
        if (flow && it.kind === 'edge') {
          const e = flow.edges.find((q) => q.index === it.index);
          return e && <path key={key} d={edgePath(e)} {...style} strokeWidth={5 / k} opacity={0.35} />;
        }
        if (it.kind === 'participant') {
          const p = layout.participants.find((q) => q.id === it.id);
          return p && box(p.x - p.width / 2, p.top, p.width, p.height, key);
        }
        if (it.kind === 'message') {
          const m = layout.messages.find((q) => q.line === it.line);
          return m && <line key={key} x1={m.x1} x2={m.x2} y1={m.y} y2={m.y} {...style} strokeWidth={5 / k} opacity={0.35} />;
        }
        if (it.kind === 'note') {
          const n = layout.notes.find((q) => q.line === it.line);
          return n && box(n.x, n.y, n.width, n.height, key);
        }
        if (it.kind === 'frame') {
          const f = layout.frames.find((q) => q.line === it.line);
          return f && box(f.x1, f.y1, f.x2 - f.x1, f.y2 - f.y1, key);
        }
        return null;
      })}
    </g>
  );
}
