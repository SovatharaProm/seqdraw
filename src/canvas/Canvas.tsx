import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { dropLine, nearestParticipant, type Layout } from '../core/layout';
import { shapeOf } from '../core/participants';
import { contentEnd } from '../core/ops';
import { FONT_FAMILY, FONT_SIZE, LINE_HEIGHT } from '../core/measure';
import { THEMES, type Theme } from '../core/themes';
import { DiagramContent, selfPath, StatementShape } from '../render/DiagramSvg';
import * as actions from '../state/actions';
import { Icons } from '../ui/icons';
import { selectionForLine, useStore, type EditTarget, type Selection } from '../state/store';

type View = { x: number; y: number; k: number };
type Pt = { x: number; y: number };

type Drag =
  | { type: 'pan'; start: Pt; view: View; moved: boolean; clear: boolean }
  | { type: 'participant'; id: string; start: Pt; origX: number; dx: number; moved: boolean }
  | { type: 'statement'; line: number; start: Pt; x: number; y: number; moved: boolean }
  | { type: 'resize'; id: string; start: Pt; w: number; h: number; dw: number; dh: number }
  | { type: 'connect'; from: string; start: Pt; to: Pt }
  | { type: 'reconnect'; line: number; end: 'from' | 'to'; start: Pt; to: Pt };

const MIN_K = 0.1;
const MAX_K = 4;
const DRAG_THRESHOLD = 4;
const SELF_W = 40;

export const requestFit = () => window.dispatchEvent(new Event('seqdraw:fit'));

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

// Inline editor box
function editBox(layout: Layout, t: EditTarget): { x: number; y: number; w: number; h: number; multiline: boolean } | null | undefined {
  if (t.kind === 'participant') {
    const p = layout.participants.find((q) => q.id === t.id);
    return p && { x: p.x - p.width / 2, y: p.top + (shapeOf(p.kind).icon ? p.height - LINE_HEIGHT - 4 : (p.height - 28) / 2), w: p.width, h: 28, multiline: false };
  }
  if (t.kind === 'message') {
    const m = layout.messages.find((q) => q.line === t.line);
    if (!m) return null;
    const cx = m.self ? m.x1 + SELF_W / 2 : (m.x1 + m.x2) / 2;
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

export function Canvas() {
  const layout = useStore((s) => s.layout);
  const theme = THEMES[useStore((s) => s.theme)] ?? THEMES.default;
  const selection = useStore((s) => s.selection);
  const editing = useStore((s) => s.editing);
  const doc = useStore((s) => s.doc);

  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const panning = spaceDown || panMode;

  const updateDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const toDiagram = useCallback((clientX: number, clientY: number): Pt => {
    const r = box.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - r.left - v.x) / v.k, y: (clientY - r.top - v.y) / v.k };
  }, []);

  const zoomAt = useCallback((factor: number, sx?: number, sy?: number) => {
    const r = box.current!.getBoundingClientRect();
    const v = viewRef.current;
    const px = sx ?? r.width / 2;
    const py = sy ?? r.height / 2;
    const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
    setView({ k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k });
  }, []);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const { bounds: b } = useStore.getState().layout;
    const r = el.getBoundingClientRect();
    // Dock and badge offsets
    const dock = el.parentElement?.querySelector<HTMLElement>('.palette');
    const top = 56;
    const bottom = dock ? dock.offsetHeight + 28 : 20;
    const h = r.height - top - bottom;
    const k = Math.min(1.25, Math.max(MIN_K, Math.min((r.width - 48) / b.width, h / b.height)));
    setView({ k, x: (r.width - b.width * k) / 2 - b.x * k, y: top + Math.max(0, (h - b.height * k) / 2) - b.y * k });
  }, []);

  useLayoutEffect(() => {
    fit();
    // Refit after layout
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
  }, [fit]);

  useEffect(() => {
    const onFit = () => fit();
    const onZoom = (e: Event) => zoomAt((e as CustomEvent<number>).detail);
    window.addEventListener('seqdraw:fit', onFit);
    window.addEventListener('seqdraw:zoom', onZoom);
    return () => {
      window.removeEventListener('seqdraw:fit', onFit);
      window.removeEventListener('seqdraw:zoom', onZoom);
    };
  }, [fit, zoomAt]);

  // Wheel zoom / pan
  useEffect(() => {
    const el = box.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      const { selection: sel, setEditing, select } = useStore.getState();
      if (e.key === ' ') {
        setSpaceDown(true);
        e.preventDefault();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        actions.deleteSelection(sel);
      } else if (e.key === 'Escape') {
        if (dragRef.current) updateDrag(null);
        else select(null);
      } else if ((e.key === 'Enter' || e.key === 'F2') && sel) {
        e.preventDefault();
        setEditing(sel.kind === 'participant' ? sel : { kind: sel.kind, line: sel.line });
      } else if ((e.key === '=' || e.key === '+') && !e.metaKey && !e.ctrlKey) zoomAt(1.2);
      else if (e.key === '-' && !e.metaKey && !e.ctrlKey) zoomAt(1 / 1.2);
    };
    const up = (e: KeyboardEvent) => e.key === ' ' && setSpaceDown(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [zoomAt]);

  // Pointer interaction

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (useStore.getState().editing) return;
    const target = e.target as Element;
    const p = toDiagram(e.clientX, e.clientY);
    const start = p;
    svgRef.current!.setPointerCapture(e.pointerId);
    const { select, layout: L } = useStore.getState();

    if (e.button === 1 || panning) {
      return updateDrag({ type: 'pan', start: { x: e.clientX, y: e.clientY }, view, moved: false, clear: false });
    }
    if (e.button !== 0) return;

    const handle = target.closest<SVGElement>('[data-handle]');
    if (handle) {
      const h = handle.dataset.handle!;
      if (h === 'connect' && hover) return updateDrag({ type: 'connect', from: hover.id, start: { x: hover.x, y: hover.y }, to: p });
      if (h === 'resize' && selection?.kind === 'participant') {
        const lp = L.participants.find((q) => q.id === selection.id)!;
        return updateDrag({ type: 'resize', id: lp.id, start, w: lp.width, h: lp.height, dw: 0, dh: 0 });
      }
      if ((h === 'from' || h === 'to') && selection?.kind === 'message') {
        return updateDrag({ type: 'reconnect', line: selection.line, end: h, start, to: p });
      }
    }

    const el = target.closest<SVGElement>('[data-kind]');
    const kind = el?.dataset.kind;
    const line = Number(el?.dataset.line);
    if (kind === 'participant') {
      const id = el!.dataset.id!;
      select({ kind: 'participant', id });
      const lp = L.participants.find((q) => q.id === id)!;
      return updateDrag({ type: 'participant', id, start, origX: lp.x, dx: 0, moved: false });
    }
    if (kind === 'message' || kind === 'note') {
      select({ kind, line });
      return updateDrag({ type: 'statement', line, start, x: p.x, y: p.y, moved: false });
    }
    if (kind === 'frame' || kind === 'frame-label') {
      select({ kind: 'frame', line });
      return updateDrag({ type: 'statement', line, start, x: p.x, y: p.y, moved: false });
    }
    if (kind === 'branch') {
      select(selectionForLine(useStore.getState().doc, line));
      return;
    }
    updateDrag({ type: 'pan', start: { x: e.clientX, y: e.clientY }, view, moved: false, clear: true });
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    const p = toDiagram(e.clientX, e.clientY);
    if (!d) {
      // Lifeline hover dot
      const overElement = (e.target as Element).closest('[data-kind], [data-handle]');
      if ((e.target as Element).closest('[data-handle="connect"]')) return;
      const lp = nearestParticipant(layout, p.x);
      if (!overElement && lp && Math.abs(lp.x - p.x) < 10 / view.k + 4 && p.y > layout.lifelineTop + 6 && p.y < layout.lifelineBottom - 4)
        setHover({ id: lp.id, x: lp.x, y: p.y });
      else if (hover) setHover(null);
      return;
    }
    const k = view.k;
    const moved = (a: Pt) => Math.hypot(p.x - a.x, p.y - a.y) * k > DRAG_THRESHOLD;
    switch (d.type) {
      case 'pan': {
        const dx = e.clientX - d.start.x;
        const dy = e.clientY - d.start.y;
        setView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy });
        if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) updateDrag({ ...d, moved: true });
        break;
      }
      case 'participant':
        updateDrag({ ...d, dx: p.x - d.start.x, moved: d.moved || moved(d.start) });
        break;
      case 'statement':
        updateDrag({ ...d, x: p.x, y: p.y, moved: d.moved || moved(d.start) });
        break;
      case 'resize':
        updateDrag({ ...d, dw: (p.x - d.start.x) * 2, dh: p.y - d.start.y });
        break;
      case 'connect':
      case 'reconnect':
        updateDrag({ ...d, to: p });
        break;
    }
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    updateDrag(null);
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
    if (!d) return;
    switch (d.type) {
      case 'pan':
        if (!d.moved && d.clear) useStore.getState().select(null);
        break;
      case 'participant':
        if (d.moved) actions.moveParticipant(d.id, d.origX + d.dx);
        break;
      case 'statement':
        if (d.moved) actions.moveStatement(d.line, d.y, d.x - d.start.x);
        break;
      case 'resize':
        if (d.dw || d.dh) actions.resizeParticipant(d.id, Math.max(40, d.w + d.dw), Math.max(30, d.h + d.dh));
        break;
      case 'connect': {
        const tgt = nearestParticipant(layout, d.to.x);
        if (!tgt || Math.abs(tgt.x - d.to.x) > 60) break;
        const travelled = Math.hypot(d.to.x - d.start.x, d.to.y - d.start.y);
        if (tgt.id === d.from && travelled < 20) break;
        actions.connect(d.from, tgt.id, d.start.y);
        setHover(null);
        break;
      }
      case 'reconnect': {
        const tgt = nearestParticipant(layout, d.to.x);
        if (tgt && Math.abs(tgt.x - d.to.x) < 60) actions.updateStatement(d.line, { [d.end]: tgt.id });
        break;
      }
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    // Hit test
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGElement>('[data-kind]');
    const kind = el?.dataset.kind;
    const line = Number(el?.dataset.line);
    const { setEditing } = useStore.getState();
    if (kind === 'participant') setEditing({ kind: 'participant', id: el!.dataset.id! });
    else if (kind === 'message' || kind === 'note' || kind === 'branch') setEditing({ kind, line });
    else if (kind === 'frame' || kind === 'frame-label') {
      const f = layout.frames.find((q) => q.line === line);
      if (f && f.kind !== 'rect') setEditing({ kind: 'frame', line });
    }
  };

  // Palette drop
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-seqdraw')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (e: React.DragEvent) => {
    const item = e.dataTransfer.getData('application/x-seqdraw') as actions.PaletteItem;
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    actions.addItem(item, toDiagram(e.clientX, e.clientY));
  };

  const k = view.k;
  const accent = 'var(--accent)';
  const grid = theme.grid ?? `color-mix(in srgb, ${theme.text} ${theme.gridStyle === 'lines' ? 14 : 22}%, ${theme.background})`;
  const gridFine = `color-mix(in srgb, ${grid} 45%, transparent)`;
  const cursor = panning || drag?.type === 'pan' ? (drag ? 'grabbing' : 'grab') : drag?.type === 'participant' ? 'ew-resize' : drag?.type === 'statement' ? 'grabbing' : 'default';

  return (
    <div
      className="canvas"
      ref={box}
      style={{
        // Selection color
        ['--accent' as string]: theme.dark ? '#818cf8' : '#4f46e5',
        ['--accent-soft' as string]: theme.dark ? 'rgba(129, 140, 248, 0.18)' : 'rgba(79, 70, 229, 0.12)',
        // Canvas grid
        backgroundColor: theme.background,
        ...(theme.gridStyle === 'lines'
          ? {
              backgroundImage: [
                `linear-gradient(${grid} 1px, transparent 1px)`,
                `linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
                `linear-gradient(${gridFine} 1px, transparent 1px)`,
                `linear-gradient(90deg, ${gridFine} 1px, transparent 1px)`,
              ].join(', '),
              backgroundSize: `${100 * k}px ${100 * k}px, ${100 * k}px ${100 * k}px, ${20 * k}px ${20 * k}px, ${20 * k}px ${20 * k}px`,
            }
          : {
              backgroundImage: `radial-gradient(circle, ${grid} ${Math.max(1, 1.2 * k)}px, transparent ${Math.max(1, 1.2 * k) + 0.5}px)`,
              backgroundSize: `${24 * k}px ${24 * k}px`,
            }),
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => !dragRef.current && setHover(null)}
        onDoubleClick={onDoubleClick}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          {drag?.type === 'statement' && drag.moved && <style>{`.diagram-main [data-line="${drag.line}"] { opacity: 0.25; }`}</style>}
          <g className="diagram-main">
            <DiagramContent layout={layout} theme={theme} background={false} />
          </g>
          <SelectionOverlay layout={layout} selection={selection} k={k} />
          {hover && !drag && !panning && (
            <g data-handle="connect" style={{ cursor: 'crosshair' }}>
              <circle cx={hover.x} cy={hover.y} r={12 / k} fill="transparent" />
              <circle cx={hover.x} cy={hover.y} r={6 / k} fill={accent} stroke="white" strokeWidth={1.5 / k} />
              <title>Drag to another lifeline to add a message</title>
            </g>
          )}
          {drag && <DragOverlay drag={drag} layout={layout} theme={theme} k={k} end={contentEnd(doc.lines)} />}
        </g>
      </svg>
      {editing && <InlineEditor target={editing} layout={layout} view={view} fontFamily={theme.fontFamily} />}
      <div className="zoom-controls" role="toolbar" aria-label="Zoom">
        <button className={panMode ? 'active' : ''} aria-pressed={panMode} title="Hand tool: drag anywhere to pan (or hold Space)" aria-label="Hand tool" onClick={() => setPanMode(!panMode)}><Icons.hand /></button>
        <span className="zoom-sep" />
        <button title="Zoom out (-)" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.2)}><Icons.zoomOut /></button>
        <button className="zoom-pct" title="Reset to 100%" aria-label="Reset to 100%" onClick={() => zoomAt(1 / view.k)}>{Math.round(k * 100)}%</button>
        <button title="Zoom in (+)" aria-label="Zoom in" onClick={() => zoomAt(1.2)}><Icons.zoomIn /></button>
        <button title="Fit diagram (⌘0)" aria-label="Fit diagram" onClick={fit}><Icons.fit /></button>
      </div>
    </div>
  );
}

function SelectionOverlay({ layout, selection, k }: { layout: Layout; selection: Selection | null; k: number }) {
  if (!selection) return null;
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

function DragOverlay({ drag: d, layout, theme, k, end }: { drag: Drag; layout: Layout; theme: Theme; k: number; end: number }) {
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

function InlineEditor({ target, layout, view, fontFamily }: { target: EditTarget; layout: Layout; view: View; fontFamily: string }) {
  const [value, setValue] = useState(() => actions.editText(target));
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const b = editBox(layout, target);

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

  return (
    <textarea
      ref={ref}
      className="inline-editor"
      value={value}
      rows={rows}
      spellCheck={false}
      placeholder={target.kind === 'message' ? 'Message text' : ''}
      style={{
        left: b.x * view.k + view.x,
        top: b.y * view.k + view.y,
        width: b.w * view.k,
        minHeight: b.h * view.k,
        fontSize: FONT_SIZE * view.k,
        fontFamily,
        lineHeight: `${LINE_HEIGHT * view.k}px`,
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
  );
}
