// Flowchart SVG renderer
import type { ReactNode } from 'react';
import { FONT_SIZE, LINE_HEIGHT } from '../core/measure';
import { participantColors, type Theme } from '../core/themes';
import type { FCluster, FEdge, FlowLayout, FNode, Pt } from '../flow/layout';
import type { LinkEnd } from '../flow/model';
import { flowShapeOf } from '../flow/shapes';

const HEAD = 9;

// d3 curveBasis
export function basisPath(pts: Pt[]): string {
  if (pts.length < 3) return pts.length ? `M${pts.map((p) => `${p.x} ${p.y}`).join(' L')}` : '';
  let d = `M${pts[0].x} ${pts[0].y}`;
  let [x0, y0, x1, y1] = [pts[0].x, pts[0].y, pts[1].x, pts[1].y];
  d += ` L${(5 * x0 + x1) / 6} ${(5 * y0 + y1) / 6}`;
  const curve = (x: number, y: number) => {
    d += ` C${(2 * x0 + x1) / 3} ${(2 * y0 + y1) / 3} ${(x0 + 2 * x1) / 3} ${(y0 + 2 * y1) / 3} ${(x0 + 4 * x1 + x) / 6} ${(y0 + 4 * y1 + y) / 6}`;
    [x0, y0, x1, y1] = [x1, y1, x, y];
  };
  for (let i = 2; i < pts.length; i++) curve(pts[i].x, pts[i].y);
  curve(x1, y1);
  return `${d} L${x1} ${y1}`;
}

function Label({ lines, x, y, fill, weight }: { lines: string[]; x: number; y: number; fill: string; weight?: string | number }) {
  // y = block center
  const top = y - (lines.length * LINE_HEIGHT) / 2;
  return (
    <text x={x} fill={fill} fontSize={FONT_SIZE} fontWeight={weight === 'normal' ? undefined : weight} textAnchor="middle">
      {lines.map((l, i) => (
        <tspan key={i} x={x} y={top + (i + 1) * LINE_HEIGHT - 4}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function NodeShape({ n, t }: { n: FNode; t: Theme }) {
  const def = flowShapeOf(n.shape);
  const c = participantColors(t, n.index);
  const fill = n.style.fill ?? c.fill;
  const stroke = n.style.stroke ?? c.stroke;
  const sw = n.style.strokeWidth ?? t.strokeWidth;
  const left = n.x - n.width / 2;
  const top = n.y - n.height / 2;
  return (
    <g data-kind="node" data-id={n.id}>
      <g transform={`translate(${left} ${top})`}>
        {def.bare ? (
          <path d={def.outline(n.width, n.height, t.radius)} fill="transparent" stroke="none" />
        ) : (
          <path d={def.outline(n.width, n.height, t.radius)} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={n.style.dash} strokeLinejoin="round" />
        )}
        {def.extra && <path d={def.extra(n.width, n.height)} fill="none" stroke={stroke} strokeWidth={sw} />}
      </g>
      <Label lines={n.label} x={n.x} y={n.y + (def.labelDy?.(n.width, n.height) ?? 0)} fill={n.style.color ?? t.text} />
    </g>
  );
}

// End marker at `tip`, pointing from `from`
function Marker({ kind, tip, from, color, width }: { kind: LinkEnd; tip: Pt; from: Pt; color: string; width: number }): ReactNode {
  const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / len;
  const uy = (tip.y - from.y) / len;
  const at = (back: number, side: number) => `${tip.x - ux * back - uy * side} ${tip.y - uy * back + ux * side}`;
  if (kind === 'arrow') return <path d={`M${at(0, 0)} L${at(HEAD, HEAD / 2)} L${at(HEAD, -HEAD / 2)} Z`} fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />;
  if (kind === 'circle') return <circle cx={tip.x - ux * 4.5} cy={tip.y - uy * 4.5} r={4} fill={color} stroke={color} strokeWidth={1} />;
  if (kind === 'cross') {
    const c = 4;
    const cx = tip.x - ux * 6;
    const cy = tip.y - uy * 6;
    return <path d={`M${cx - c} ${cy - c} L${cx + c} ${cy + c} M${cx - c} ${cy + c} L${cx + c} ${cy - c}`} stroke={color} strokeWidth={Math.max(1.5, width)} />;
  }
  return null;
}

// Trim path ends under markers
function trimmed(pts: Pt[], start: LinkEnd, end: LinkEnd): Pt[] {
  const cut = (a: Pt, b: Pt, by: number) => {
    const len = Math.hypot(a.x - b.x, a.y - b.y);
    if (len <= by + 1) return a;
    return { x: a.x + ((b.x - a.x) * by) / len, y: a.y + ((b.y - a.y) * by) / len };
  };
  const amount = (k: LinkEnd) => (k === 'arrow' ? HEAD - 2 : k === 'circle' ? 8 : 0);
  const out = pts.slice();
  if (out.length >= 2) {
    out[0] = cut(out[0], out[1], amount(start));
    out[out.length - 1] = cut(out[out.length - 1], out[out.length - 2], amount(end));
  }
  return out;
}

// Polyline with rounded corners
export function roundedPath(pts: Pt[], r = 8): string {
  if (pts.length < 3) return basisPath(pts);
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, c, n] = [pts[i - 1], pts[i], pts[i + 1]];
    const k = Math.min(r, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2);
    const at = (q: Pt) => {
      const len = Math.hypot(q.x - c.x, q.y - c.y) || 1;
      return `${c.x + ((q.x - c.x) * k) / len} ${c.y + ((q.y - c.y) * k) / len}`;
    };
    d += ` L${at(p)} Q${c.x} ${c.y} ${at(n)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last.x} ${last.y}`;
}

export function edgePath(e: FEdge): string {
  const pts = trimmed(e.points, e.spec.start, e.spec.end);
  return e.ortho ? roundedPath(pts) : basisPath(pts);
}

function Edge({ e, t }: { e: FEdge; t: Theme }) {
  if (e.spec.stroke === 'invisible' || e.points.length < 2) return <g data-kind="edge" data-id={e.index} data-line={e.line} />;
  const color = e.style.stroke ?? t.message;
  const base = t.lineWidth ?? 1.5;
  const width = e.style.strokeWidth ?? (e.spec.stroke === 'thick' ? base * 2.5 : base);
  const dash = e.style.dash ?? (e.spec.stroke === 'dotted' ? '3 3' : undefined);
  const d = edgePath(e);
  const p = e.points;
  return (
    <g data-kind="edge" data-id={e.index} data-line={e.line}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} className="hit" />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} />
      <Marker kind={e.spec.end} tip={p[p.length - 1]} from={p[p.length - 2]} color={color} width={width} />
      <Marker kind={e.spec.start} tip={p[0]} from={p[1]} color={color} width={width} />
      {e.labelBox && (
        <g>
          <rect x={e.labelBox.x} y={e.labelBox.y} width={e.labelBox.width} height={e.labelBox.height} rx={3} fill={t.background} fillOpacity={0.92} />
          <Label lines={e.label} x={e.labelBox.x + e.labelBox.width / 2} y={e.labelBox.y + e.labelBox.height / 2} fill={e.style.color ?? t.text} />
        </g>
      )}
    </g>
  );
}

function Cluster({ c, t }: { c: FCluster; t: Theme }) {
  return (
    <g data-kind="subgraph" data-id={c.id} data-line={c.line}>
      <rect x={c.x} y={c.y} width={c.width} height={c.height} rx={Math.min(t.radius, 6)} fill={t.frameLabelFill} fillOpacity={t.dark ? 0.55 : 0.6} stroke={t.frameStroke} strokeWidth={1} strokeDasharray={t.frameDash} />
      <Label lines={c.title} x={c.x + c.width / 2} y={c.y + 6 + (c.title.length * LINE_HEIGHT) / 2} fill={t.text} weight={t.labelWeight} />
    </g>
  );
}

export function FlowContent({ layout, theme: t, background = true }: { layout: FlowLayout; theme: Theme; background?: boolean }) {
  const b = layout.bounds;
  return (
    <g fontFamily={t.fontFamily}>
      {background && <rect x={b.x} y={b.y} width={b.width} height={b.height} fill={t.background} />}
      {layout.title && (
        <text x={layout.title.x} y={layout.title.y} fill={t.text} fontSize={18} fontWeight="bold" textAnchor="middle">
          {layout.title.text}
        </text>
      )}
      {[...layout.clusters].sort((a, b) => a.depth - b.depth).map((c) => (
        <Cluster key={c.id} c={c} t={t} />
      ))}
      {layout.edges.map((e) => (
        <Edge key={e.index} e={e} t={t} />
      ))}
      {layout.nodes.map((n) => (
        <NodeShape key={n.id} n={n} t={t} />
      ))}
    </g>
  );
}

// Standalone SVG
export function FlowSvg({ layout, theme, scale = 1, background = true }: { layout: FlowLayout; theme: Theme; scale?: number; background?: boolean }) {
  const b = layout.bounds;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={b.width * scale} height={b.height * scale} viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`}>
      <FlowContent layout={layout} theme={theme} background={background} />
    </svg>
  );
}

// Single node (drag ghost)
export function FlowNodeShape({ node, theme }: { node: FNode; theme: Theme }) {
  return <NodeShape n={node} t={theme} />;
}
