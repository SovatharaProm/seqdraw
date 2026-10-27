// SVG renderer
import type { ReactNode } from 'react';
import type { LFrame, LMessage, LNote, LParticipant, Layout } from '../core/layout';
import { FONT_SIZE, LINE_HEIGHT } from '../core/measure';
import { participantColors, type Theme } from '../core/themes';

const SELF_W = 40;
const HEAD = 9;

function Text({ lines, x, y, fill, anchor = 'middle', weight }: { lines: string[]; x: number; y: number; fill: string; anchor?: 'start' | 'middle' | 'end'; weight?: string | number }) {
  // Baselines
  return (
    <text x={x} fill={fill} fontSize={FONT_SIZE} fontWeight={weight === 'normal' ? undefined : weight} textAnchor={anchor}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} y={y + (i + 1) * LINE_HEIGHT - 4}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

export function ParticipantShape({ p, y, t }: { p: LParticipant; y: number; t: Theme }) {
  const left = p.x - p.width / 2;
  const { fill, stroke } = participantColors(t, p.index);
  const sw = t.strokeWidth;
  const label = p.label;
  const at = (top: number) => <Text lines={[label]} x={p.x} y={top} fill={t.text} weight={t.labelWeight} />;
  if (p.kind === 'actor') {
    const cx = p.x;
    const s = Math.min(1.4, Math.max(0.8, (p.height - 20) / 52));
    const headR = 8 * s;
    const top = y + 4;
    const neck = top + headR * 2;
    const hip = neck + 18 * s;
    return (
      <g>
        <rect x={left} y={y} width={p.width} height={p.height} fill="transparent" />
        <g fill="none" stroke={stroke} strokeWidth={Math.max(2, sw)} strokeLinecap="round">
          <circle cx={cx} cy={top + headR} r={headR} fill={fill} />
          <path d={`M${cx} ${neck} V${hip} M${cx - 14 * s} ${neck + 7 * s} H${cx + 14 * s} M${cx} ${hip} L${cx - 11 * s} ${hip + 14 * s} M${cx} ${hip} L${cx + 11 * s} ${hip + 14 * s}`} />
        </g>
        {at(y + p.height - LINE_HEIGHT)}
      </g>
    );
  }
  if (p.kind === 'boundary' || p.kind === 'control' || p.kind === 'entity') {
    // Boundary / control / entity
    const s = Math.min(1.4, Math.max(0.8, (p.height - 20) / 52));
    const r = 14 * s;
    const cx = p.kind === 'boundary' ? p.x + 6 * s : p.x;
    const cy = y + 6 + r;
    const w = Math.max(2, sw);
    let extra: ReactNode = null;
    if (p.kind === 'boundary') {
      const bx = cx - r - 10 * s;
      extra = <path d={`M${bx} ${cy - r} V${cy + r} M${bx} ${cy} H${cx - r}`} />;
    } else if (p.kind === 'control') {
      extra = <path d={`M${cx + 4 * s} ${cy - r - 5 * s} L${cx - 2 * s} ${cy - r} L${cx + 4 * s} ${cy - r + 5 * s}`} />;
    } else {
      extra = <path d={`M${cx - r} ${cy + r + 3 * s} H${cx + r}`} />;
    }
    return (
      <g>
        <rect x={left} y={y} width={p.width} height={p.height} fill="transparent" />
        <g fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={cx} cy={cy} r={r} fill={fill} />
          {extra}
        </g>
        {at(y + p.height - LINE_HEIGHT)}
      </g>
    );
  }
  if (p.kind === 'collections') {
    const o = 5;
    return (
      <g>
        <rect x={left + o} y={y} width={p.width - o} height={p.height - o} rx={t.radius} fill={fill} stroke={stroke} strokeWidth={sw} />
        <rect x={left} y={y + o} width={p.width - o} height={p.height - o} rx={t.radius} fill={fill} stroke={stroke} strokeWidth={sw} />
        <Text lines={[label]} x={p.x - o / 2} y={y + o + (p.height - o - LINE_HEIGHT) / 2} fill={t.text} weight={t.labelWeight} />
      </g>
    );
  }
  if (p.kind === 'queue') {
    const rx = 8;
    const ry = p.height / 2;
    const right = left + p.width;
    const bottom = y + p.height;
    return (
      <g>
        <path
          d={`M${left + rx} ${y} H${right - rx} A${rx} ${ry} 0 0 1 ${right - rx} ${bottom} H${left + rx} A${rx} ${ry} 0 0 1 ${left + rx} ${y} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
        <path d={`M${right - rx} ${y} A${rx} ${ry} 0 0 0 ${right - rx} ${bottom}`} fill="none" stroke={stroke} strokeWidth={sw} />
        <Text lines={[label]} x={p.x - rx / 2} y={y + (p.height - LINE_HEIGHT) / 2} fill={t.text} weight={t.labelWeight} />
      </g>
    );
  }
  if (p.kind === 'database') {
    const ry = 7;
    const right = left + p.width;
    const bottom = y + p.height;
    return (
      <g>
        <path
          d={`M${left} ${y + ry} A${p.width / 2} ${ry} 0 0 1 ${right} ${y + ry} V${bottom - ry} A${p.width / 2} ${ry} 0 0 1 ${left} ${bottom - ry} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
        <path d={`M${left} ${y + ry} A${p.width / 2} ${ry} 0 0 0 ${right} ${y + ry}`} fill="none" stroke={stroke} strokeWidth={sw} />
        {at(y + ry + (p.height - ry - LINE_HEIGHT) / 2)}
      </g>
    );
  }
  return (
    <g>
      <rect x={left} y={y} width={p.width} height={p.height} rx={t.radius} fill={fill} stroke={stroke} strokeWidth={sw} />
      {at(y + (p.height - LINE_HEIGHT) / 2)}
    </g>
  );
}

// Self message curve
export const selfPath = (x1: number, y: number, x2: number) => `M${x1} ${y} C${x1 + SELF_W * 1.2} ${y - 6}, ${x1 + SELF_W * 1.2} ${y + 34}, ${x2} ${y + 28}`;

function arrowHead(x: number, y: number, dir: 1 | -1, kind: 'arrow' | 'open' | 'cross', color: string): ReactNode {
  if (kind === 'arrow')
    return <path d={`M${x} ${y} L${x - dir * HEAD} ${y - HEAD / 2} L${x - dir * HEAD} ${y + HEAD / 2} Z`} fill={color} stroke={color} strokeWidth={1} />;
  if (kind === 'open')
    return <path d={`M${x - dir * HEAD} ${y - HEAD / 2} L${x} ${y} L${x - dir * HEAD} ${y + HEAD / 2}`} fill="none" stroke={color} strokeWidth={1.5} />;
  const c = 5;
  const cx = x - dir * c;
  return <path d={`M${cx - c} ${y - c} L${cx + c} ${y + c} M${cx - c} ${y + c} L${cx + c} ${y - c}`} stroke={color} strokeWidth={2} />;
}

function Message({ m, t }: { m: LMessage; t: Theme }) {
  const dash = m.spec.line === 'dotted' ? '3 3' : undefined;
  const { head } = m.spec;
  const color = t.message;
  let d: string;
  let endDir: 1 | -1;
  let labelX: number;
  let endX: number;
  let endY: number;
  if (m.self) {
    endY = m.y + 28;
    endX = m.x2;
    d = selfPath(m.x1, m.y, m.x2);
    endDir = -1;
    labelX = m.x1 + SELF_W / 2;
  } else {
    endY = m.y;
    endX = m.x2;
    endDir = m.x2 >= m.x1 ? 1 : -1;
    d = `M${m.x1} ${m.y} H${m.x2}`;
    labelX = (m.x1 + m.x2) / 2;
  }
  return (
    <g data-kind="message" data-line={m.line}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} className="hit" />
      <path d={d} fill="none" stroke={color} strokeWidth={t.lineWidth ?? 1.5} strokeDasharray={dash} />
      {head !== 'none' && arrowHead(endX, endY, endDir, head === 'both' ? 'arrow' : head, color)}
      {head === 'both' && arrowHead(m.x1, m.y, (m.self ? -1 : -endDir) as 1 | -1, 'arrow', color)}
      <Text lines={m.text} x={labelX} y={m.textY} fill={t.text} />
      {m.number !== undefined && (
        <g>
          <circle cx={m.x1} cy={m.y} r={9} fill={t.numberFill} />
          <text x={m.x1} y={m.y + 4} fill={t.numberText} fontSize={11} fontWeight="bold" textAnchor="middle">
            {m.number}
          </text>
        </g>
      )}
    </g>
  );
}

// Note with folded corner
const FOLD = 10;
function Note({ n, t }: { n: LNote; t: Theme }) {
  const r = n.x + n.width;
  const b = n.y + n.height;
  return (
    <g data-kind="note" data-line={n.line}>
      <path d={`M${n.x} ${n.y} H${r - FOLD} L${r} ${n.y + FOLD} V${b} H${n.x} Z`} fill={t.noteFill} stroke={t.noteStroke} strokeWidth={1} strokeLinejoin="round" />
      <path d={`M${r - FOLD} ${n.y} V${n.y + FOLD} H${r}`} fill={t.noteStroke} fillOpacity={0.25} stroke={t.noteStroke} strokeWidth={1} strokeLinejoin="round" />
      <Text lines={n.text} x={n.x + n.width / 2} y={n.y + 10} fill={t.text} />
    </g>
  );
}

function Frame({ f, t }: { f: LFrame; t: Theme }) {
  if (f.kind === 'rect') {
    return (
      <g data-kind="frame" data-line={f.line}>
        <rect x={f.x1} y={f.y1} width={f.x2 - f.x1} height={f.y2 - f.y1} fill={f.label || 'rgba(128,128,128,0.1)'} stroke="none" />
      </g>
    );
  }
  const tabW = Math.max(46, f.kind.length * 8 + 20);
  const tabH = 20;
  return (
    <g data-kind="frame" data-line={f.line}>
      <rect x={f.x1} y={f.y1} width={f.x2 - f.x1} height={f.y2 - f.y1} rx={Math.min(t.radius, 6)} fill="none" stroke={t.frameStroke} strokeWidth={t.frameDash ? 1 : Math.min(t.strokeWidth, 1.5)} strokeDasharray={t.frameDash} />
      <path d={`M${f.x1} ${f.y1} H${f.x1 + tabW} V${f.y1 + tabH - 6} L${f.x1 + tabW - 6} ${f.y1 + tabH} H${f.x1} Z`} fill={t.frameLabelFill} stroke={t.frameStroke} strokeWidth={1} className="frame-tab" />
      <text x={f.x1 + tabW / 2} y={f.y1 + 14} fill={t.text} fontSize={12} fontWeight="bold" textAnchor="middle">
        {f.kind}
      </text>
      {f.label && (
        <g data-kind="frame-label" data-line={f.line}>
          <Text lines={[`[${f.label}]`]} x={(f.x1 + tabW + f.x2) / 2} y={f.y1 + 1} fill={t.text} />
        </g>
      )}
      {f.sections.map((s) => (
        <g key={s.line} data-kind="branch" data-line={s.line}>
          <line x1={f.x1} x2={f.x2} y1={s.y} y2={s.y} stroke={t.frameStroke} strokeWidth={t.frameDash ? 1 : 1.5} strokeDasharray={t.frameDash ?? '5 4'} />
          <Text lines={[`[${s.label}]`]} x={(f.x1 + f.x2) / 2} y={s.y + 2} fill={t.text} />
        </g>
      ))}
    </g>
  );
}

// Single statement (drag ghost)
export function StatementShape({ layout, line, theme: t }: { layout: Layout; line: number; theme: Theme }) {
  const m = layout.messages.find((q) => q.line === line);
  if (m) return <Message m={m} t={t} />;
  const n = layout.notes.find((q) => q.line === line);
  if (n) return <Note n={n} t={t} />;
  const f = layout.frames.find((q) => q.line === line);
  return f ? <Frame f={f} t={t} /> : null;
}

// Diagram content
export function DiagramContent({ layout, theme: t, background = true }: { layout: Layout; theme: Theme; background?: boolean }) {
  const b = layout.bounds;
  const colorOf = (id: string) => participantColors(t, layout.participants.find((p) => p.id === id)?.index ?? 0);
  return (
    <g fontFamily={t.fontFamily}>
      {background && <rect x={b.x} y={b.y} width={b.width} height={b.height} fill={t.background} />}
      {layout.title && (
        <text x={layout.title.x} y={layout.title.y} fill={t.text} fontSize={18} fontWeight="bold" textAnchor="middle">
          {layout.title.text}
        </text>
      )}
      {layout.frames.map((f) => (
        <Frame key={f.line} f={f} t={t} />
      ))}
      {layout.participants.map((p) => (
        <line
          key={p.id}
          x1={p.x}
          x2={p.x}
          y1={p.top + p.height}
          y2={p.bottom}
          stroke={t.lifeline}
          strokeWidth={t.lineWidth ?? 1}
        />
      ))}
      {layout.activations.map((a, i) => {
        const c = colorOf(a.actor);
        return (
          <rect
            key={i}
            x={a.x - 5}
            y={a.y1}
            width={10}
            height={Math.max(4, a.y2 - a.y1)}
            rx={Math.min(t.radius, 2)}
            fill={t.palette ? c.fill : t.activationFill}
            stroke={t.palette ? c.stroke : t.activationStroke}
            strokeWidth={1}
          />
        );
      })}
      {layout.participants.map((p) => (
        <g key={p.id} data-kind="participant" data-id={p.id}>
          <ParticipantShape p={p} y={p.top} t={t} />
          <ParticipantShape p={p} y={p.bottom} t={t} />
        </g>
      ))}
      {layout.notes.map((n) => (
        <Note key={n.line} n={n} t={t} />
      ))}
      {layout.messages.map((m) => (
        <Message key={m.line} m={m} t={t} />
      ))}
    </g>
  );
}

// Standalone SVG
export function DiagramSvg({ layout, theme, scale = 1, background = true }: { layout: Layout; theme: Theme; scale?: number; background?: boolean }) {
  const b = layout.bounds;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={b.width * scale} height={b.height * scale} viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`}>
      <DiagramContent layout={layout} theme={theme} background={background} />
    </svg>
  );
}
