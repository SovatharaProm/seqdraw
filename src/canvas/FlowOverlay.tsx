// Flowchart canvas overlays
import type { Theme } from '../core/themes';
import { editableEdge, facingSide, midpoint, movedRoute, nodeAt, orthoRoute, portPoint, sideAt, sidePoint, SIDES, type FlowLayout, type FNode, type Pt } from '../flow/layout';
import type { Side } from '../flow/model';
import { isFreeEnd } from '../flow/shapes';
import { edgePath, FlowNodeShape, linePath, roundedPath, smoothPath } from '../render/FlowSvg';
import type { Selection } from '../state/store';

export type FlowDrag =
  // `ids`: every node moving with it
  | { type: 'node'; id: string; ids: string[]; start: Pt; dx: number; dy: number; moved: boolean; guideX?: number; guideY?: number }
  | { type: 'flow-connect'; from: string; fromSide: Side; start: Pt; to: Pt; free?: boolean }
  | { type: 'flow-reconnect'; index: number; end: 'from' | 'to'; start: Pt; to: Pt; free?: boolean }
  // Drag one segment of a link's route
  | { type: 'flow-segment'; index: number; seg: number; pts: Pt[]; sides: [Side, Side]; axis: 'x' | 'y'; start: Pt; delta: number }
  // Move or add a bend
  | { type: 'flow-bend'; index: number; bends: Pt[]; i: number; insert: boolean; at: Pt; moved: boolean }
  // Corner drag: `sx`/`sy` the corner's side
  | { type: 'flow-resize'; id: string; start: Pt; sx: 1 | -1; sy: 1 | -1; from: Box; box: Box };

type Box = { x: number; y: number; w: number; h: number };

const none = { pointerEvents: 'none' as const };
const CORNERS: [1 | -1, 1 | -1][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const SNAP = 6;

// Snap distance (screen px)
const SPOT_SNAP = 6;
// Link snaps this close to a node (screen px)
const NODE_SNAP = 4;
const MIN_W = 30;
const MIN_H = 20;

// Box after dragging a corner (opposite corner stays)
export function resizedBox(d: { start: Pt; sx: 1 | -1; sy: 1 | -1; from: Box }, p: Pt): Box {
  const { from: b, sx, sy } = d;
  const w = Math.max(MIN_W, b.w + sx * (p.x - d.start.x));
  const h = Math.max(MIN_H, b.h + sy * (p.y - d.start.y));
  return { x: b.x - (sx * b.w) / 2 + (sx * w) / 2, y: b.y - (sy * b.h) / 2 + (sy * h) / 2, w, h };
}

// Side and spot under the pointer (snaps to the middle and to `toward`; `free`: no snap)
export function snapTarget(layout: FlowLayout, p: Pt, k: number, opts: { toward?: Pt; free?: boolean } = {}): { node: FNode; side: Side; at: number; point: Pt } | null {
  const node = nodeAt(layout, p, NODE_SNAP / k);
  if (!node) return null;
  const side = facingSide(node, p);
  const snap = opts.free ? 0 : SPOT_SNAP / k;
  const q = { ...p };
  const t = opts.toward;
  if (t && !opts.free) {
    // Line up with the other end
    if (side === 'left' || side === 'right') {
      if (Math.abs(q.y - t.y) <= snap && Math.abs(t.y - node.y) <= node.height / 2) q.y = t.y;
    } else if (Math.abs(q.x - t.x) <= snap && Math.abs(t.x - node.x) <= node.width / 2) q.x = t.x;
  }
  const aligned = q.x !== p.x || q.y !== p.y;
  const at = sideAt(node, side, q, aligned ? 0 : snap);
  return { node, side, at, point: sidePoint(node, side, at) };
}

// Bends after a move or insert
export function bendsAfter(d: { bends: Pt[]; i: number; insert: boolean; at: Pt }): Pt[] {
  const out = d.bends.slice();
  out.splice(d.i, d.insert ? 0 : 1, d.at);
  return out;
}

// Line a bend up with its neighbours
export function snapBend(pts: Pt[], p: Pt, k: number): Pt {
  const r = { ...p };
  for (const q of pts) {
    if (Math.abs(q.x - p.x) < SNAP / k) r.x = q.x;
    if (Math.abs(q.y - p.y) < SNAP / k) r.y = q.y;
  }
  return r;
}

// Draggable dot with a wider hit area
function Dot({ at, k, r = 4, hollow, cursor, tip, data }: { at: Pt; k: number; r?: number; hollow?: boolean; cursor: string; tip: string; data: Record<string, string | number> }) {
  const attrs = Object.fromEntries(Object.entries(data).map(([key, v]) => [`data-${key}`, v]));
  return (
    <g {...attrs} style={{ cursor }}>
      <circle cx={at.x} cy={at.y} r={(r + 5) / k} fill="transparent" />
      <circle cx={at.x} cy={at.y} r={r / k} fill={hollow ? 'white' : 'var(--accent)'} stroke={hollow ? 'var(--accent)' : 'white'} strokeWidth={1.5 / k} />
      <title>{tip}</title>
    </g>
  );
}

const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Bends (solid) and add spots (hollow)
function BendHandles({ e, k }: { e: FlowLayout['edges'][number]; k: number }) {
  const pts = e.points;
  return (
    <g>
      {pts.slice(0, -1).map((a, i) =>
        Math.hypot(pts[i + 1].x - a.x, pts[i + 1].y - a.y) < 24 / k ? null : (
          <Dot key={`n${i}`} at={mid(a, pts[i + 1])} k={k} r={3.5} hollow cursor="copy" tip="Drag to add a bend" data={{ handle: 'bend-new', i }} />
        ),
      )}
      {pts.slice(1, -1).map((p, i) => (
        <Dot key={`b${i}`} at={p} k={k} r={4.5} cursor="move" tip="Drag to move, double-click to remove" data={{ handle: 'bend', i }} />
      ))}
    </g>
  );
}

// Segment handles (a curve: one in the middle)
function SegmentHandles({ layout, index, k }: { layout: FlowLayout; index: number; k: number }) {
  const e = layout.edges.find((q) => q.index === index);
  if (e && (e.shape === 'straight' || e.shape === 'curved')) return <BendHandles e={e} k={k} />;
  const ed = e && editableEdge(layout, e);
  if (!e || !ed) return null;
  const tip = 'Drag to move this part of the link';
  if (!e.ortho) return <Dot at={midpoint(e.points)} k={k} cursor="move" tip={tip} data={{ handle: 'segment', seg: 'auto' }} />;
  const pts = ed.pts;
  return (
    <g>
      {pts.slice(1, -2).map((a, j) => {
        const b = pts[j + 2];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 14 / k) return null;
        return <Dot key={j} at={mid(a, b)} k={k} cursor={Math.abs(a.y - b.y) < 0.5 ? 'ns-resize' : 'ew-resize'} tip={tip} data={{ handle: 'segment', seg: j + 1 }} />;
      })}
    </g>
  );
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
          <Dot key={side} at={p} k={k} r={4.5} cursor="crosshair" tip="Drag to a side of another node to connect, or to empty space for a loose arrow" data={{ handle: 'flow-connect', id: node.id, side, x: p.x, y: p.y }} />
        );
      })}
    </g>
  );
}

// Target node's sides, snapped one larger
function SnapDots({ node, side, point, k }: { node: FNode; side: Side; point: Pt; k: number }) {
  return (
    <g style={none}>
      <rect x={node.x - node.width / 2 - 4} y={node.y - node.height / 2 - 4} width={node.width + 8} height={node.height + 8} rx={4} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.5 / k} />
      {SIDES.map((s) => {
        const p = portPoint(node, s);
        return <circle key={s} cx={p.x} cy={p.y} r={4 / k} fill="white" stroke="var(--accent)" strokeWidth={1.5 / k} />;
      })}
      <circle cx={point.x} cy={point.y} r={7 / k} fill="var(--accent)" stroke="white" strokeWidth={1.5 / k} data-side={side} />
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
    if (!n) return null;
    const s = 9 / k;
    const hit = 18 / k;
    return (
      <g>
        <rect x={n.x - n.width / 2 - pad} y={n.y - n.height / 2 - pad} width={n.width + pad * 2} height={n.height + pad * 2} rx={4} {...style} />
        {!isFreeEnd({ shape: n.shape, label: n.label.join('') }) &&
          CORNERS.map(([sx, sy]) => {
            const cx = n.x + sx * (n.width / 2 + pad);
            const cy = n.y + sy * (n.height / 2 + pad);
            return (
              <g key={`${sx}${sy}`} data-handle="flow-resize" data-sx={sx} data-sy={sy} style={{ cursor: sx === sy ? 'nwse-resize' : 'nesw-resize' }}>
                {/* Wider hit area */}
                <rect x={cx - hit / 2} y={cy - hit / 2} width={hit} height={hit} fill="transparent" />
                <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={1.5 / k} fill="white" stroke="var(--accent)" strokeWidth={1.5 / k} />
                <title>Drag to resize, double-click to fit the text</title>
              </g>
            );
          })}
      </g>
    );
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
        <SegmentHandles layout={layout} index={e.index} k={k} />
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
          {layout.nodes.filter((q) => d.ids.includes(q.id)).map((q) => (
            <g key={q.id}>
              <FlowNodeShape node={q} theme={theme} />
              <rect x={q.x - q.width / 2 - 4} y={q.y - q.height / 2 - 4} width={q.width + 8} height={q.height + 8} rx={4} fill="none" stroke={accent} strokeWidth={sw} strokeDasharray={dash} />
            </g>
          ))}
        </g>
      </g>
    );
  }
  if (d.type === 'flow-resize') {
    const n = layout.nodes.find((q) => q.id === d.id);
    if (!n) return null;
    const b = d.box;
    return (
      <g style={none}>
        <FlowNodeShape node={{ ...n, x: b.x, y: b.y, width: b.w, height: b.h }} theme={theme} />
        <rect x={b.x - b.w / 2 - 4} y={b.y - b.h / 2 - 4} width={b.w + 8} height={b.h + 8} rx={4} fill="none" stroke={accent} strokeWidth={sw} strokeDasharray={dash} />
      </g>
    );
  }
  if (d.type === 'flow-bend') {
    const e = layout.edges.find((q) => q.index === d.index);
    if (!e || !d.moved) return null;
    const pts = [e.points[0], ...bendsAfter(d), e.points[e.points.length - 1]];
    return (
      <g style={none}>
        <path d={e.shape === 'curved' ? smoothPath(pts) : linePath(pts)} fill="none" stroke={accent} strokeWidth={sw} strokeDasharray={dash} />
        <circle cx={d.at.x} cy={d.at.y} r={5 / k} fill={accent} />
      </g>
    );
  }
  if (d.type === 'flow-segment') {
    const e = layout.edges.find((q) => q.index === d.index);
    return <g style={none}>{e && <path d={roundedPath(movedRoute(d))} fill="none" stroke={accent} strokeWidth={sw} strokeDasharray={dash} />}</g>;
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
  const snap = snapTarget(layout, d.to, k, { toward: from, free: d.free });
  const to = snap ? snap.point : d.to;
  const path = snap && fromSide ? roundedPath(orthoRoute(from, fromSide, snap.point, snap.side)) : `M${from.x} ${from.y} L${to.x} ${to.y}`;
  return (
    <g style={none}>
      {snap && <SnapDots node={snap.node} side={snap.side} point={snap.point} k={k} />}
      <path d={path} fill="none" stroke={accent} strokeWidth={sw} strokeDasharray={dash} />
      {!snap && <circle cx={to.x} cy={to.y} r={5 / k} fill={accent} />}
    </g>
  );
}
