// Icons
import type { ReactNode, SVGProps } from 'react';
import type { FlowShape } from '../flow/model';
import { flowShapeOf } from '../flow/shapes';

const Icon = ({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    {children}
  </svg>
);

// Logo
export const Logo = () => (
  <svg width={22} height={22} viewBox="0 0 32 32" aria-hidden>
    <rect width="32" height="32" rx="7" fill="currentColor" />
    <g style={{ color: 'var(--primary-text)' }} stroke="currentColor" fill="none">
      <rect x="5" y="6" width="8" height="5" rx="1" fill="currentColor" stroke="none" />
      <rect x="19" y="6" width="8" height="5" rx="1" fill="currentColor" stroke="none" />
      <path d="M9 11v16M23 11v16" strokeDasharray="2 2" />
      <path d="M9 18h12M18 15l3 3-3 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

export const Icons = {
  participant: () => <Icon><rect x="2" y="4" width="12" height="8" rx="1.5" /></Icon>,
  actor: () => <Icon><circle cx="8" cy="3.5" r="2" /><path d="M8 5.5v5M4.5 7.5h7M8 10.5l-3 4M8 10.5l3 4" /></Icon>,
  database: () => <Icon><ellipse cx="8" cy="3.5" rx="5" ry="1.8" /><path d="M3 3.5v9c0 1 2.2 1.8 5 1.8s5-.8 5-1.8v-9" /></Icon>,
  boundary: () => <Icon><circle cx="9.5" cy="8" r="4.5" /><path d="M2 3.5v9M2 8h3" /></Icon>,
  control: () => <Icon><circle cx="8" cy="9" r="5" /><path d="M9.5 2 7.5 4l2 2" /></Icon>,
  entity: () => <Icon><circle cx="8" cy="7" r="5" /><path d="M3 14h10" /></Icon>,
  collections: () => <Icon><rect x="4.5" y="2.5" width="10" height="8" rx="1.5" /><rect x="1.5" y="5.5" width="10" height="8" rx="1.5" fill="var(--panel)" /></Icon>,
  queue: () => <Icon><path d="M4 4.5h8a2 3.5 0 0 1 0 7H4a2 3.5 0 0 1 0-7z" /><path d="M12 4.5a2 3.5 0 0 0 0 7" /></Icon>,
  message: () => <Icon><path d="M2 8h11M10 5l3 3-3 3" /></Icon>,
  note: () => <Icon><path d="M3 2.5h7l3 3v8H3z" /><path d="M10 2.5v3h3M5.5 8.5h5M5.5 11h3" /></Icon>,
  loop: () => <Icon><path d="M13 8a5 5 0 1 1-1.5-3.5" /><path d="M12 1.8v3h-3" /></Icon>,
  alt: () => <Icon><path d="M8 14V8M8 8 4 3M8 8l4-5" /><path d="M2.5 4.5 4 3l1.5 1.5M10.5 4.5 12 3l1.5 1.5" /></Icon>,
  opt: () => <Icon><rect x="2" y="2.5" width="12" height="11" rx="1.5" strokeDasharray="2 1.6" /><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.2v.1" /></Icon>,
  par: () => <Icon><path d="M2 5h12M2 11h12M11 2.5 13.5 5 11 7.5M11 8.5l2.5 2.5-2.5 2.5" /></Icon>,
  critical: () => <Icon><path d="M8 1.8 14.5 13.5h-13z" /><path d="M8 6v3.5M8 11.5v.1" /></Icon>,
  break: () => <Icon><path d="M2 8h6M8 4v8M11 5l3 3-3 3" /></Icon>,
  zoomIn: () => <Icon><circle cx="7" cy="7" r="4.5" /><path d="M10.4 10.4 14 14M5 7h4M7 5v4" /></Icon>,
  zoomOut: () => <Icon><circle cx="7" cy="7" r="4.5" /><path d="M10.4 10.4 14 14M5 7h4" /></Icon>,
  fit: () => <Icon><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></Icon>,
  hand: () => <Icon><path d="M5.5 8.5V3.8a1 1 0 0 1 2 0V7.5M7.5 7V2.8a1 1 0 0 1 2 0V7.5M9.5 7.5V3.8a1 1 0 0 1 2 0v5.4c0 2.7-1.8 4.8-4.3 4.8-1.6 0-2.6-.8-3.5-2L2.3 9.4a1 1 0 0 1 1.5-1.3L5.5 9.6" /></Icon>,
  book: () => <Icon><path d="M2.5 3h4A1.5 1.5 0 0 1 8 4.5V14a1.5 1.5 0 0 0-1.5-1.5h-4zM13.5 3h-4A1.5 1.5 0 0 0 8 4.5V14a1.5 1.5 0 0 1 1.5-1.5h4z" /></Icon>,
  close: () => <Icon><path d="M4 4l8 8M12 4l-8 8" /></Icon>,
  play: () => <Icon><path d="M5 3.5v9l7-4.5z" /></Icon>,
  chevronLeft: () => <Icon><path d="M10 3.5 5.5 8l4.5 4.5" /></Icon>,
  shapes: () => <Icon><rect x="2" y="2" width="5" height="5" rx="1" /><circle cx="11.5" cy="4.5" r="2.5" /><path d="M4.5 9.5 7 14H2zM9 9h5v5H9z" /></Icon>,
  trash: () => <Icon><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.8 6.5v4.5M9.2 6.5v4.5" /></Icon>,
  undo: () => <Icon><path d="M5.5 3 2.5 6l3 3" /><path d="M2.5 6h7a4 4 0 0 1 0 8H7" /></Icon>,
  redo: () => <Icon><path d="M10.5 3l3 3-3 3" /><path d="M13.5 6h-7a4 4 0 0 0 0 8H9" /></Icon>,
  help: () => <Icon><circle cx="8" cy="8" r="6.2" /><path d="M6.2 6.2a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.7.6-.7 1.1M8 11.2v.1" /></Icon>,
  error: () => <Icon><circle cx="8" cy="8" r="6.2" /><path d="M8 4.8v3.8M8 11v.1" /></Icon>,
  sun: () => <Icon><circle cx="8" cy="8" r="2.8" /><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" /></Icon>,
  moon: () => <Icon><path d="M13.5 9.8A5.8 5.8 0 0 1 6.2 2.5a5.8 5.8 0 1 0 7.3 7.3z" /></Icon>,
  lineSolid: () => <Icon><path d="M2 8h12" /></Icon>,
  lineDotted: () => <Icon><path d="M2 8h12" strokeDasharray="2 2" /></Icon>,
  arrowDotted: () => <Icon><path d="M2 8h10" strokeDasharray="2 2" /><path d="M10 5l3 3-3 3" /></Icon>,
  async: () => <Icon><path d="M2 8h11M10 5l3 3" /></Icon>,
  cross: () => <Icon><path d="M2 8h8M10.5 5.5l3 5M13.5 5.5l-3 5" /></Icon>,
  self: () => <Icon><path d="M3 4.5h8a2 2 0 0 1 0 4H5" /><path d="M7 6.5 5 8.5l2 2" /><path d="M3 2v12" strokeDasharray="1.5 1.5" /></Icon>,
  roundtrip: () => <Icon><path d="M2 5h11M10 2.5 12.5 5 10 7.5" /><path d="M14 11H3" strokeDasharray="2 1.6" /><path d="M5.5 8.5 3 11l2.5 2.5" /></Icon>,
  noteLeft: () => <Icon><path d="M2 3h7l2 2v8H2z" /><path d="M4 7h4M4 9.5h3" /><path d="M14 1.5v13" /></Icon>,
  noteRight: () => <Icon><path d="M5 3h7l2 2v8H5z" /><path d="M7 7h4M7 9.5h3" /><path d="M2 1.5v13" /></Icon>,
  noteOver: () => <Icon><path d="M3 2h8l2 2v7H3z" /><path d="M5 5.5h5M5 8h3" /><path d="M1.5 14h13" /></Icon>,
  highlight: () => <Icon><rect x="2" y="3" width="12" height="10" rx="1" fill="currentColor" fillOpacity={0.15} /></Icon>,
  activate: () => <Icon><path d="M8 1.5v3M8 11.5v3" strokeDasharray="1.5 1.5" /><rect x="6" y="4.5" width="4" height="7" rx="0.5" /></Icon>,
  deactivate: () => <Icon><path d="M8 1.5v3M8 11.5v3" strokeDasharray="1.5 1.5" /><rect x="6" y="4.5" width="4" height="7" rx="0.5" strokeDasharray="1.5 1.2" /></Icon>,
  numbers: () => <Icon><circle cx="4.5" cy="4.5" r="2.5" /><circle cx="4.5" cy="11.5" r="2.5" /><path d="M9 4.5h5M9 11.5h5" /></Icon>,
  title: () => <Icon><path d="M3 3.5h10M8 3.5v9.5" /></Icon>,
  comment: () => <Icon><path d="M2.5 3h11v7.5H7L4 13v-2.5H2.5z" /></Icon>,
  brackets: () => <Icon><path d="M5 2.5H3v11h2M11 2.5h2v11h-2" /></Icon>,
  panelOpen: () => <Icon><rect x="2" y="2.5" width="12" height="11" rx="1.5" /><path d="M2.6 9h10.8v3.2a.7.7 0 0 1-.7.7H3.3a.7.7 0 0 1-.7-.7z" fill="currentColor" stroke="none" /></Icon>,
  panelClosed: () => <Icon><rect x="2" y="2.5" width="12" height="11" rx="1.5" /><path d="M2 9h12" /></Icon>,
  code: () => <Icon><path d="M5 4.5 1.5 8 5 11.5M11 4.5 14.5 8 11 11.5M9.2 2.5 6.8 13.5" /></Icon>,
  swap: () => <Icon><path d="M2.5 5.5h11M11 3l2.5 2.5L11 8M13.5 10.5h-11M5 8l-2.5 2.5L5 13" /></Icon>,
  subgraph: () => <Icon><rect x="1.5" y="2" width="13" height="12" rx="1.5" /><path d="M1.5 5h13" /><rect x="4.5" y="7.5" width="7" height="4" rx="0.8" /></Icon>,
  // Toolbar
  newFile: () => <Icon><path d="M9.5 1.5H4A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V5.5z" /><path d="M9.5 1.5v4h4M8 7.5v4M6 9.5h4" /></Icon>,
  folder: () => <Icon><path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 6v6A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12z" /></Icon>,
  save: () => <Icon><path d="M3 1.5h8l3.5 3.5v8a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V3A1.5 1.5 0 0 1 3 1.5z" /><path d="M4.5 1.5v3.5h6v-3.5M4.5 14.5v-5h7v5" /></Icon>,
  export: () => <Icon><path d="M8 10V1.5M5 4.5l3-3 3 3" /><path d="M2.5 9v3.5A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V9" /></Icon>,
  barUp: () => <Icon><path d="M2.5 2.5h11M8 13.5V6M5 9l3-3 3 3" /></Icon>,
  barDown: () => <Icon><path d="M2.5 13.5h11M8 2.5V10M5 7l3 3 3-3" /></Icon>,
  chevronDown: () => <Icon width={10} height={10} strokeWidth={1.8}><path d="M4 6l4 4 4-4" /></Icon>,
  // Layout engines
  hierarchical: () => <Icon><circle cx="8" cy="3" r="1.6" /><circle cx="3.5" cy="13" r="1.6" /><circle cx="8" cy="13" r="1.6" /><circle cx="12.5" cy="13" r="1.6" /><path d="M8 4.6v6.8M8 8H3.5v3.4M8 8h4.5v3.4" /></Icon>,
  adaptive: () => <Icon><circle cx="4" cy="3" r="1.6" /><circle cx="4" cy="13" r="1.6" /><circle cx="12" cy="13" r="1.6" /><path d="M4 4.6v6.8M4 7.5c0 2.5 2 3 4 3s4 .3 4 .9" /></Icon>,
  flowchart: () => <Icon><rect x="5" y="1.5" width="6" height="3.5" rx="0.8" /><path d="M8 5v2.5M8 7.5 11 10 8 12.5 5 10z" /><path d="M8 12.5v2" /></Icon>,
};

// Flowchart shape icon (from the registry)
export function ShapeIcon({ shape }: { shape: FlowShape }) {
  const def = flowShapeOf(shape);
  const { w, h } = def.size(28, 14);
  // Fit in 13 x 10
  const s = Math.min(13 / w, 10 / h, 1);
  const bw = w * s;
  const bh = h * s;
  return (
    <Icon>
      <g transform={`translate(${(16 - bw) / 2} ${(16 - bh) / 2}) scale(${s})`} strokeWidth={1.4 / s}>
        <path d={def.outline(w, h, 3 / s)} />
        {def.extra && <path d={def.extra(w, h)} />}
      </g>
    </Icon>
  );
}
