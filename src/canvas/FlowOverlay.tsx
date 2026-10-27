// Flowchart canvas overlays
import type { Theme } from '../core/themes';
import { nearestSide, nodeAt, orthoRoute, portPoint, SIDES, type FlowLayout, type FNode, type Pt } from '../flow/layout';
import type { Side } from '../flow/model';
import { edgePath, FlowNodeShape, roundedPath } from '../render/FlowSvg';
import type { Selection } from '../state/store';

export type FlowDrag =
  | { type: 'node'; id: string; start: Pt; dx: number; dy: number; moved: boolean; guideX?: number; guideY?: number }
  | { type: 'flow-connect'; from: string; fromSide: Side; start: Pt; to: Pt }
  | { type: 'flow-reconnect'; index: number; end: 'from' | 'to'; start: Pt; to: Pt };

const none = { pointerEvents: 'none' as const };
const SNAP = 6;

// Node side under the pointer
export function snapTarget(layout: FlowLayout, p: Pt, k: number): { node: FNode; side: Side; point: Pt } | null {
  const node = nodeAt(layout, p, 14 / k);
  if (!node) return null;
  const side = nearestSide(node, p);
  return { node, side, point: portPoint(node, side) };
}

// Arrow end under the pointer (any link)
export function edgeEndAt(layout: FlowLayout, p: Pt, k: number): { index: number; end: 'from' | 'to'; point: Pt } | null {
  let best: { index: number; end: 'from' | 'to'; point: Pt } | null = null;
  let dist = 9 / k;
  for (const e of layout.edges) {
    if (e.spec.stroke === 'invisible' || e.points.length < 2) continue;
    // Arrow tips first
    const ends: ['from' | 'to', Pt][] = [['to', e.points[e.points.length - 1]], ['from', e.points[0]]];
    for (const [end, q] of ends) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < dist) [best, dist] = [{ index: e.index, end, point: q }, d];
    }
  }
  return best;
}

// Ring on a grabbable arrow end
export function EndHover({ point, k }: { point: Pt; k: number }) {
  return <circle style={none} cx={point.x} cy={point.y} r={6 / k} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.5 / k} />;
}

// Align a dragged node with the others
export function alignNode(layout: FlowLayout, id: string, dx: number, dy: number, k: number): { dx: number; dy: number; guideX?: number; guideY?: number } {
  const n = layout.nodes.find((q) => q.id === id);
  if (!n) return { dx, dy };
  const x = n.x + dx;
  const y = n.y + dy;
  let bestX: number | undefined;
  let bestY: number | undefined;
  for (const m of layout.nodes) {
    if (m.id === id) continue;
    if (Math.abs(m.x - x) < SNAP / k && (bestX === undefined || Math.abs(m.x - x) < Math.abs(bestX - x))) bestX = m.x;
    if (Math.abs(m.y - y) < SNAP / k && (bestY === undefined || Math.abs(m.y - y) < Math.abs(bestY - y))) bestY = m.y;
  }
  return { dx: bestX !== undefined ? bestX - n.x : dx, dy: bestY !== undefined ? bestY - n.y : dy, guideX: bestX, guideY: bestY };
}

export function FlowHandles({ node, k }: { node: FNode; k: number }) {
  return (
    <g>
      {SIDES.map((side) => {
        const p = portPoint(node, side);
        return (
          <g key={side} data-handle="flow-connect" data-id={node.id} data-side={side} data-x={p.x} data-y={p.y} style={{ cursor: 'crosshair' }}>
            <circle cx={p.x} cy={p.y} r={10 / k} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={4.5 / k} fill="var(--accent)" stroke="white" strokeWidth={1.5 / k} />
            <title>Drag to a side of another node to connect, or to empty space for a new node</title>
          </g>
        );
      })}
    </g>
  );
}

// Target node's sides, snapped one larger
function SnapDots({ node, side, k }: { node: FNode; side: Side; k: number }) {
  return (
    <g style={none}>
      <rect x={node.x - node.width / 2 - 4} y={node.y - node.height / 2 - 4} width={node.width + 8} height={node.height + 8} rx={4} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.5 / k} />
      {SIDES.map((s) => {
        const p = portPoint(node, s);
        return <circle key={s} cx={p.x} cy={p.y} r={(s === side ? 7 : 4) / k} fill={s === side ? 'var(--accent)' : 'white'} stroke="var(--accent)" strokeWidth={1.5 / k} />;
      })}
    </g>
  );
}

export function FlowSelectionOverlay({ layout, selection, k }: { layout: FlowLayout; selection: Selection | null; k: number }) {
  if (!selection) return null;
  const pad = 4;
  const sw = 2 / k;
  const style = { fill: 'none', stroke: 'var(--accent)', strokeWidth: sw, pointerEvents: 'none' as const };
  if (selection.kind === 'node') {
    const n = layout.nodes.find((q) => q.id === selection.id);
    return n ? <rect x={n.x - n.width / 2 - pad} y={n.y - n.height / 2 - pad} width={n.width + pad * 2} height={n.height + pad * 2} rx={4} {...style} /> : null;
  }
  if (selection.kind === 'subgraph') {
    const c = layout.clusters.find((q) => q.id === selection.id);
    return c ? <rect x={c.x - pad} y={c.y - pad} width={c.width + pad * 2} height={c.height + pad * 2} rx={4} {...style} strokeDasharray={`${6 / k} ${4 / k}`} /> : null;
  }
  if (selection.kind === 'edge') {
    const e = layout.edges.find((q) => q.index === selection.index);
    if (!e || e.points.length < 2) return null;
    const a = e.points[0];
    const b = e.points[e.points.length - 1];
    const r = 6 / k;
    return (
      <g>
        <path d={edgePath(e)} {...style} strokeWidth={5 / k} opacity={0.35} />
        {e.labelBox && <rect x={e.labelBox.x - 2} y={e.labelBox.y - 2} width={e.labelBox.width + 4} height={e.labelBox.height + 4} rx={3} {...style} strokeWidth={1 / k} />}
        <circle data-handle="from" cx={a.x} cy={a.y} r={r} fill="white" stroke="var(--accent)" strokeWidth={sw} style={{ cursor: 'move' }}>
          <title>Drag to a side of any node to move the start</title>
        </circle>
        <circle data-handle="to" cx={b.x} cy={b.y} r={r} fill="var(--accent)" stroke="white" strokeWidth={sw} style={{ cursor: 'move' }}>
          <title>Drag to a side of any node to move the end</title>
        </circle>
      </g>
    );
  }
  return null;
}

export function FlowDragOverlay({ drag: d, layout, theme, k }: { drag: FlowDrag; layout: FlowLayout; theme: Theme; k: number }) {
  const accent = 'var(--accent)';
  const sw = 2 / k;
  const dash = `${6 / k} ${4 / k}`;
  if (d.type === 'node') {
    if (!d.moved) return null;
    const n = layout.nodes.find((q) => q.id === d.id);
    if (!n) return null;
    const b = layout.bounds;
    return (
      <g style={none}>
        {d.guideX !== undefined && <line x1={d.guideX} x2={d.guideX} y1={b.y} y2={b.y + b.height} stroke={accent} strokeWidth={1 / k} strokeDasharray={`${4 / k} ${3 / k}`} />}
        {d.guideY !== undefined && <line x1={b.x} x2={b.x + b.width} y1={d.guideY} y2={d.guideY} stroke={accent} strokeWidth={1 / k} strokeDasharray={`${4 / k} ${3 / k}`} />}
        <g opacity={0.8} transform={`translate(${d.dx} ${d.dy})`}>
          <FlowNodeShape node={n} theme={theme} />
          <rect x={n.x - n.width / 2 - 4} y={n.y - n.height / 2 - 4} width={n.width + 8} height={n.height + 8} rx={4} fill="none" stroke={accent} strokeWidth={sw} strokeDasharray={dash} />
        </g>
      </g>
    );
  }
  // Fixed end of the link
  let from: Pt;
  let fromSide: Side | undefined;
  if (d.type === 'flow-connect') {
    from = d.start;
    fromSide = d.fromSide;
  } else {
    const e = layout.edges.find((q) => q.index === d.index);
    if (!e || e.points.length < 2) return null;
    from = d.end === 'to' ? e.points[0] : e.points[e.points.length - 1];
    fromSide = d.end === 'to' ? e.fromSide : e.toSide;
  }
  const snap = snapTarget(layout, d.to, k);
  const to = snap ? snap.point : d.to;
  const path = snap && fromSide ? roundedPath(orthoRoute(from, fromSide, snap.point, snap.side)) : `M${from.x} ${from.y} L${to.x} ${to.y}`;
  return (
    <g style={none}>
      {snap && <SnapDots node={snap.node} side={snap.side} k={k} />}
      <path d={path} fill="none" stroke={accent} strokeWidth={sw} strokeDasharray={dash} />
      {!snap && <circle cx={to.x} cy={to.y} r={5 / k} fill={accent} />}
      {!snap && d.type === 'flow-connect' && (
        <rect x={d.to.x - 50} y={d.to.y - 20} width={100} height={40} rx={4} fill="var(--accent-soft)" stroke={accent} strokeWidth={1 / k} strokeDasharray={`${4 / k} ${4 / k}`} />
      )}
    </g>
  );
}
