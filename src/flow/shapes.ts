// Flowchart node shape registry
import type { FlowShape } from './model';

type Pt = [number, number];

export interface FlowShapeDef {
  shape: FlowShape;
  name: string;
  hint: string;
  // Mermaid brackets
  open: string;
  close: string;
  // `@{ shape: ... }` names
  aliases: string[];
  // Shown in the palette
  palette: boolean;
  defaultLabel: string;
  // Box size for a text block
  size(tw: number, th: number): { w: number; h: number };
  // Outline (origin top-left)
  outline(w: number, h: number, r: number): string;
  // Inner strokes
  extra?(w: number, h: number): string;
  // No outline (text only)
  bare?: boolean;
  // Polygon for edge clipping (rect when unset)
  polygon?(w: number, h: number): Pt[];
  round?: boolean;
  // Label y offset
  labelDy?(w: number, h: number): number;
}

const PX = 16;
const PY = 14;
const poly = (pts: Pt[]) => `M${pts.map((p) => p.join(' ')).join(' L')} Z`;
const rectPath = (w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  return `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${h - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 0 ${h - r} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`;
};
const ellipse = (w: number, h: number) => `M0 ${h / 2} A${w / 2} ${h / 2} 0 1 1 ${w} ${h / 2} A${w / 2} ${h / 2} 0 1 1 0 ${h / 2} Z`;
const box = (tw: number, th: number, extraW = 0) => ({ w: tw + PX * 2 + extraW, h: th + PY * 2 });
const cylRy = (w: number) => Math.min(10, w / 8);
const slant = (h: number) => h / 3;

const polygonShape = (pts: (w: number, h: number) => Pt[]) => ({ outline: (w: number, h: number) => poly(pts(w, h)), polygon: pts });

export const FLOW_SHAPES: readonly FlowShapeDef[] = [
  { shape: 'rect', name: 'Process', hint: 'A step  A[text]', open: '[', close: ']', aliases: ['rect', 'proc', 'process', 'rectangle'], palette: true, defaultLabel: 'Step', size: (tw, th) => box(tw, th), outline: (w, h, r) => rectPath(w, h, Math.min(r, 6)) },
  { shape: 'round', name: 'Rounded', hint: 'An event  A(text)', open: '(', close: ')', aliases: ['rounded', 'event'], palette: true, defaultLabel: 'Event', size: (tw, th) => box(tw, th), outline: (w, h) => rectPath(w, h, 10) },
  { shape: 'stadium', name: 'Terminal', hint: 'Start or end  A([text])', open: '([', close: '])', aliases: ['stadium', 'pill', 'terminal'], palette: true, defaultLabel: 'Start', size: (tw, th) => box(tw, th, th / 2 + PY), outline: (w, h) => rectPath(w, h, h / 2) },
  {
    shape: 'diamond', name: 'Decision', hint: 'A question  A{text}', open: '{', close: '}', aliases: ['diam', 'diamond', 'decision', 'question'], palette: true, defaultLabel: 'Decision?',
    size: (tw, th) => {
      const s = tw + th + PY * 2;
      return { w: s, h: s };
    },
    ...polygonShape((w, h) => [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]),
  },
  {
    shape: 'cylinder', name: 'Database', hint: 'A data store  A[(text)]', open: '[(', close: ')]', aliases: ['cyl', 'cylinder', 'database', 'db'], palette: true, defaultLabel: 'Database',
    size: (tw, th) => {
      const w = tw + PX * 2;
      return { w, h: th + PY * 2 + cylRy(w) * 2 };
    },
    outline: (w, h) => {
      const ry = cylRy(w);
      return `M0 ${ry} A${w / 2} ${ry} 0 0 1 ${w} ${ry} V${h - ry} A${w / 2} ${ry} 0 0 1 0 ${h - ry} Z`;
    },
    extra: (w) => {
      const ry = cylRy(w);
      return `M0 ${ry} A${w / 2} ${ry} 0 0 0 ${w} ${ry}`;
    },
    labelDy: (w) => cylRy(w) / 2,
  },
  {
    shape: 'circle', name: 'Circle', hint: 'A connector  A((text))', open: '((', close: '))', aliases: ['circle', 'circ'], palette: true, defaultLabel: 'Go', round: true,
    size: (tw, th) => {
      const d = Math.max(tw, th) + PY * 2;
      return { w: d, h: d };
    },
    outline: ellipse,
  },
  {
    shape: 'double-circle', name: 'Double circle', hint: 'A stop point  A(((text)))', open: '(((', close: ')))', aliases: ['dbl-circ', 'double-circle'], palette: false, defaultLabel: 'Stop', round: true,
    size: (tw, th) => {
      const d = Math.max(tw, th) + PY * 2 + 10;
      return { w: d, h: d };
    },
    outline: ellipse,
    extra: (w, h) => `M5 ${h / 2} A${w / 2 - 5} ${h / 2 - 5} 0 1 1 ${w - 5} ${h / 2} A${w / 2 - 5} ${h / 2 - 5} 0 1 1 5 ${h / 2} Z`,
  },
  {
    shape: 'subroutine', name: 'Subroutine', hint: 'A predefined process  A[[text]]', open: '[[', close: ']]', aliases: ['subproc', 'subprocess', 'subroutine', 'fr-rect', 'framed-rectangle'], palette: true, defaultLabel: 'Subroutine',
    size: (tw, th) => box(tw, th, 16),
    outline: (w, h) => rectPath(w, h, 0),
    extra: (w, h) => `M8 0 V${h} M${w - 8} 0 V${h}`,
  },
  { shape: 'hexagon', name: 'Hexagon', hint: 'A preparation step  A{{text}}', open: '{{', close: '}}', aliases: ['hex', 'hexagon', 'prepare'], palette: true, defaultLabel: 'Prepare', size: (tw, th) => box(tw, th, (th + PY * 2) / 2), ...polygonShape((w, h) => [[h / 4, 0], [w - h / 4, 0], [w, h / 2], [w - h / 4, h], [h / 4, h], [0, h / 2]]) },
  { shape: 'parallelogram', name: 'Input / output', hint: 'Data in or out  A[/text/]', open: '[/', close: '/]', aliases: ['lean-r', 'lean-right', 'in-out'], palette: true, defaultLabel: 'Input', size: (tw, th) => box(tw, th, slant(th + PY * 2)), ...polygonShape((w, h) => [[slant(h), 0], [w, 0], [w - slant(h), h], [0, h]]) },
  { shape: 'parallelogram-alt', name: 'Output', hint: 'Leaning left  A[\\text\\]', open: '[\\', close: '\\]', aliases: ['lean-l', 'lean-left', 'out-in'], palette: false, defaultLabel: 'Output', size: (tw, th) => box(tw, th, slant(th + PY * 2)), ...polygonShape((w, h) => [[0, 0], [w - slant(h), 0], [w, h], [slant(h), h]]) },
  { shape: 'trapezoid', name: 'Trapezoid', hint: 'Wide at the bottom  A[/text\\]', open: '[/', close: '\\]', aliases: ['trap-b', 'trapezoid-bottom', 'priority', 'trapezoid'], palette: false, defaultLabel: 'Priority', size: (tw, th) => box(tw, th, slant(th + PY * 2) * 2), ...polygonShape((w, h) => [[slant(h), 0], [w - slant(h), 0], [w, h], [0, h]]) },
  { shape: 'trapezoid-alt', name: 'Manual step', hint: 'Wide at the top  A[\\text/]', open: '[\\', close: '/]', aliases: ['trap-t', 'trapezoid-top', 'inv-trapezoid', 'manual'], palette: false, defaultLabel: 'Manual', size: (tw, th) => box(tw, th, slant(th + PY * 2) * 2), ...polygonShape((w, h) => [[0, 0], [w, 0], [w - slant(h), h], [slant(h), h]]) },
  { shape: 'asymmetric', name: 'Flag', hint: 'Asymmetric  A>text]', open: '>', close: ']', aliases: ['odd'], palette: false, defaultLabel: 'Flag', size: (tw, th) => box(tw, th, 12), ...polygonShape((w, h) => [[0, 0], [w, 0], [w, h], [0, h], [h / 4, h / 2]]) },
  {
    shape: 'text', name: 'Text', hint: 'Borderless text  A@{ shape: text }', open: '', close: '', aliases: ['text'], palette: false, defaultLabel: 'Text', bare: true,
    // Blank: a free link end
    size: (tw, th) => (tw < 1 ? { w: 2, h: 2 } : { w: tw + 8, h: th + 4 }),
    outline: (w, h) => rectPath(w, h, 0),
  },
];

const BY_SHAPE = Object.fromEntries(FLOW_SHAPES.map((d) => [d.shape, d])) as Record<FlowShape, FlowShapeDef>;

export const flowShapeOf = (shape: FlowShape): FlowShapeDef => BY_SHAPE[shape];

export const isFlowShape = (s: string): s is FlowShape => s in BY_SHAPE;

// `@{ shape: x }` -> shape
export function shapeFromAlias(name: string): FlowShape | undefined {
  const n = name.toLowerCase();
  return FLOW_SHAPES.find((d) => d.aliases.includes(n))?.shape;
}

// Openers, longest first
export const SHAPE_OPENERS = [...new Set(FLOW_SHAPES.map((d) => d.open).filter(Boolean))].sort((a, b) => b.length - a.length);

// Free link end (blank text node)
export const isFreeEnd = (n: { shape: FlowShape; label: string }) => n.shape === 'text' && !n.label.trim();
