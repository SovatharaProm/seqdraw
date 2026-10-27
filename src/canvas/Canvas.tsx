import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { nearestParticipant } from '../core/layout';
import { contentEnd } from '../core/ops';
import { DiagramContent } from '../render/DiagramSvg';
import { FlowContent } from '../render/FlowSvg';
import { editableEdge, middleSegment, movedRoute, nodeAt, sideAt } from '../flow/layout';
import * as actions from '../state/actions';
import * as flowActions from '../state/flowActions';
import { alignNode, edgeEndAt, EndHover, FlowDragOverlay, FlowHandles, FlowSelectionOverlay, bendsAfter, snapBend, snapTarget, type FlowDrag } from './FlowOverlay';
import type { Side } from '../flow/model';
import { Icons } from '../ui/icons';
import { FIT_EVENT } from '../lib/fit';
import { useDiagramTheme } from '../state/appearance';
import { usePanel } from '../state/panel';
import { copySelection, cutSelection, deleteItems, duplicateSelection, pasteClipboard, selectedItems } from '../state/clipboard';
import { GroupOutline, MarqueeBox } from './GroupOverlay';
import { allItems, itemsInRect, rectOf } from './marquee';
import { lineSelection, useStore, type Selection } from '../state/store';
import { inkOf, InlineEditor } from './InlineEditor';
import { alignParticipant, DragOverlay, SelectionOverlay } from './SequenceOverlay';
import type { Drag, Pt, View } from './types';
import { keys } from '../lib/platform';


const MIN_K = 0.1;
const MAX_K = 4;
const DRAG_THRESHOLD = 4;

// ⌘/Ctrl + key
const SELECTION_KEYS: Record<string, () => void> = {
  a: () => useStore.getState().selectMany(allItems()),
  c: () => void copySelection(),
  x: cutSelection,
  v: pasteClipboard,
  d: duplicateSelection,
};

// Toggle an item in the selection (Shift+click)
function toggleSelected(item: Selection) {
  const items = selectedItems();
  const same = (q: Selection) => JSON.stringify(q) === JSON.stringify(item);
  useStore.getState().selectMany(items.some(same) ? items.filter((q) => !same(q)) : [...items, item]);
}

// Handles of the selected link
const LINK_HANDLES = new Set(['from', 'to', 'segment', 'bend', 'bend-new']);

// Everything selected (⌘A): drag moves the diagram
const allSelected = () => {
  const { multi } = useStore.getState();
  return multi.length > 0 && multi.length === allItems().length;
};

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

export function Canvas() {
  const layout = useStore((s) => s.layout);
  const theme = useDiagramTheme();
  const zoomBar = usePanel((s) => s.zoomBar);
  const multi = useStore((s) => s.multi);
  const selection = useStore((s) => s.selection);
  const editing = useStore((s) => s.editing);
  const doc = useStore((s) => s.doc);
  const flowLayout = useStore((s) => s.flowLayout);

  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [flowHover, setFlowHover] = useState<string | null>(null);
  const [endHover, setEndHover] = useState<Pt | null>(null);
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
    const st = useStore.getState();
    const b = (st.flowLayout ?? st.layout).bounds;
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
    window.addEventListener(FIT_EVENT, onFit);
    window.addEventListener('seqdraw:zoom', onZoom);
    return () => {
      window.removeEventListener(FIT_EVENT, onFit);
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
      const { selection: sel, multi, setEditing, select } = useStore.getState();
      if (e.key === ' ') {
        setSpaceDown(true);
        e.preventDefault();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && (sel || multi.length)) {
        e.preventDefault();
        deleteItems(selectedItems());
      } else if (e.key === 'Escape') {
        if (dragRef.current) updateDrag(null);
        else select(null);
      } else if ((e.key === 'Enter' || e.key === 'F2') && sel) {
        e.preventDefault();
        setEditing(sel);
      } else if ((e.metaKey || e.ctrlKey) && SELECTION_KEYS[e.key.toLowerCase()] && (sel || multi.length || 'av'.includes(e.key.toLowerCase())) && !document.querySelector('.modal-backdrop')) {
        e.preventDefault();
        SELECTION_KEYS[e.key.toLowerCase()]();
      } else if (e.key.startsWith('Arrow') && selectedItems().some((q) => q.kind === 'node')) {
        // Nudge nodes (Shift: 10px)
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0];
        flowActions.moveNodes(selectedItems().flatMap((q) => (q.kind === 'node' ? [q.id] : [])), dx, dy);
      } else if (e.key.startsWith('Arrow') && !useStore.getState().flowLayout && !allSelected() && selectedItems().some((q) => q.kind === 'participant')) {
        // Nudge participants (Shift: 10px)
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0];
        actions.moveParticipants(selectedItems().flatMap((q) => (q.kind === 'participant' ? [q.id] : [])), dx, dy);
      } else if (e.key.startsWith('Arrow') && !useStore.getState().flowLayout && allSelected()) {
        // Nudge the diagram (Shift: 10px)
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0];
        actions.moveDiagram(dx, dy);
      } else if ((e.key === '=' || e.key === '+') && !e.metaKey && !e.ctrlKey) zoomAt(1.2);
      else if (e.key === '-' && !e.metaKey && !e.ctrlKey) zoomAt(1 / 1.2);
      // H: hand tool, V: select
      else if (e.key.toLowerCase() === 'h' && !e.metaKey && !e.ctrlKey) setPanMode((on) => !on);
      else if (e.key.toLowerCase() === 'v' && !e.metaKey && !e.ctrlKey) setPanMode(false);
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

    if (useStore.getState().flowLayout) return flowPointerDown(target, p, e.altKey, e.shiftKey);

    const handle = target.closest<SVGElement>('[data-handle]');
    if (allSelected() && !e.shiftKey && target.closest('[data-kind]')) {
      return updateDrag({ type: 'diagram', start, dx: 0, dy: 0, moved: false });
    }
    if (handle) {
      const h = handle.dataset.handle!;
      if (h === 'connect' && hover) return updateDrag({ type: 'connect', from: hover.id, start: { x: hover.x, y: hover.y }, to: p });
      if (h === 'stretch' && selection?.kind === 'participant') return updateDrag({ type: 'stretch', id: selection.id, start, dy: 0, moved: false });
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
    if (e.shiftKey && (kind === 'participant' || kind === 'message' || kind === 'note' || kind === 'frame' || kind === 'frame-label')) {
      return toggleSelected(kind === 'participant' ? { kind, id: el!.dataset.id! } : { kind: kind === 'frame-label' ? 'frame' : kind, line });
    }
    if (kind === 'participant') {
      const id = el!.dataset.id!;
      // Part of a group: move them all
      const group = useStore.getState().multi.flatMap((q) => (q.kind === 'participant' ? [q.id] : []));
      if (!group.includes(id)) select({ kind: 'participant', id });
      return updateDrag({ type: 'participant', id, ids: group.includes(id) ? group : [id], start, dx: 0, dy: 0, moved: false });
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
      select(lineSelection(useStore.getState(), line));
      return;
    }
    updateDrag({ type: 'marquee', start: p, to: p, add: e.shiftKey });
  };

  // Flowchart pointer down
  const flowPointerDown = (target: Element, p: Pt, alt: boolean, shift: boolean) => {
    const { select, flowLayout: FL } = useStore.getState();
    const handle = target.closest<SVGElement>('[data-handle]');
    const h = handle?.dataset.handle;
    // Segment of the selected link
    if (h === 'segment' && FL && selection?.kind === 'edge') {
      const e = FL.edges.find((q) => q.index === selection.index);
      const ed = e && editableEdge(FL, e);
      if (e && ed) {
        const seg = handle!.dataset.seg === 'auto' ? middleSegment(ed.pts) : Number(handle!.dataset.seg);
        const axis = Math.abs(ed.pts[seg].y - ed.pts[seg + 1].y) < 0.5 ? 'y' : 'x';
        return updateDrag({ type: 'flow-segment', index: e.index, seg, pts: ed.pts, sides: ed.sides, axis, start: p, delta: 0 });
      }
    }
    // Bend: move or add
    if ((h === 'bend' || h === 'bend-new') && FL && selection?.kind === 'edge') {
      const e = FL.edges.find((q) => q.index === selection.index);
      if (e) {
        const i = Number(handle!.dataset.i);
        const bends = e.points.slice(1, -1);
        return updateDrag({ type: 'flow-bend', index: e.index, bends, i, insert: h === 'bend-new', at: p, moved: false });
      }
    }
    // Grab any arrow end (Alt on a dot: new link)
    const found = FL && !(alt && h === 'flow-connect') && !LINK_HANDLES.has(h ?? '') ? edgeEndAt(FL, p, view.k) : null;
    // On a dot, tips win, tails start a link
    const grab = found && !(h === 'flow-connect' && found.end === 'from') ? found : null;
    if (grab) {
      const e = FL!.edges.find((q) => q.index === grab.index)!;
      select({ kind: 'edge', index: e.index, line: e.line });
      setEndHover(null);
      return updateDrag({ type: 'flow-reconnect', index: e.index, end: grab.end, start: p, to: p });
    }
    if (h === 'flow-connect') {
      const start = { x: Number(handle!.dataset.x), y: Number(handle!.dataset.y) };
      return updateDrag({ type: 'flow-connect', from: handle!.dataset.id!, fromSide: handle!.dataset.side as Side, start, to: p });
    }
    if ((h === 'from' || h === 'to') && selection?.kind === 'edge') return updateDrag({ type: 'flow-reconnect', index: selection.index, end: h, start: p, to: p });
    const el = target.closest<SVGElement>('[data-kind]');
    const kind = el?.dataset.kind;
    if (kind === 'node') {
      const id = el!.dataset.id!;
      if (shift) return toggleSelected({ kind: 'node', id });
      // Part of a group: move them all
      const group = useStore.getState().multi.flatMap((q) => (q.kind === 'node' ? [q.id] : []));
      if (!group.includes(id)) select({ kind: 'node', id });
      return updateDrag({ type: 'node', id, ids: group.includes(id) ? group : [id], start: p, dx: 0, dy: 0, moved: false });
    }
    if (kind === 'edge') {
      const item = { kind: 'edge' as const, index: Number(el!.dataset.id), line: Number(el!.dataset.line) };
      return shift ? toggleSelected(item) : select(item);
    }
    if (kind === 'subgraph') return select({ kind: 'subgraph', id: el!.dataset.id! });
    updateDrag({ type: 'marquee', start: p, to: p, add: shift });
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    const p = toDiagram(e.clientX, e.clientY);
    const FL = useStore.getState().flowLayout;
    if (!d && FL) {
      // Node hover handles
      const n = nodeAt(FL, p, 14 / view.k);
      if ((n?.id ?? null) !== flowHover) setFlowHover(n?.id ?? null);
      const onDot = !!(e.target as Element).closest('[data-handle="flow-connect"]');
      const found = e.altKey ? null : edgeEndAt(FL, p, view.k);
      const end = found && !(onDot && found.end === 'from') ? found : null;
      if (end?.point.x !== endHover?.x || end?.point.y !== endHover?.y) setEndHover(end?.point ?? null);
      return;
    }
    if (!d) {
      // Lifeline hover dot
      const overElement = (e.target as Element).closest('[data-kind], [data-handle]');
      if ((e.target as Element).closest('[data-handle="connect"]')) return;
      const lp = nearestParticipant(layout, p.x);
      if (!overElement && lp && Math.abs(lp.x - p.x) < 10 / view.k + 4 && p.y > Math.max(layout.lifelineTop, lp.top + lp.height) + 6 && p.y < lp.bottom - 4)
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
      case 'marquee':
        updateDrag({ ...d, to: p });
        break;
      case 'participant': {
        // Snap to other participants
        const a = e.altKey ? { dx: p.x - d.start.x, dy: p.y - d.start.y } : alignParticipant(layout, d.id, p.x - d.start.x, p.y - d.start.y, view.k);
        updateDrag({ ...d, dx: a.dx, dy: a.dy, guideX: a.guideX, guideY: a.guideY, moved: d.moved || moved(d.start) });
        break;
      }
      case 'stretch':
        updateDrag({ ...d, dy: p.y - d.start.y, moved: d.moved || moved(d.start) });
        break;
      case 'diagram':
        updateDrag({ ...d, dx: p.x - d.start.x, dy: p.y - d.start.y, moved: d.moved || moved(d.start) });
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
      case 'flow-connect':
      case 'flow-reconnect':
        updateDrag({ ...d, to: p, free: e.altKey });
        break;
      case 'flow-segment':
        updateDrag({ ...d, delta: Math.round(d.axis === 'x' ? p.x - d.start.x : p.y - d.start.y) });
        break;
      case 'flow-bend': {
        // Snap into line
        const link = FL?.edges.find((q) => q.index === d.index);
        const near = link ? [link.points[0], ...d.bends.filter((_, j) => d.insert || j !== d.i), link.points[link.points.length - 1]] : [];
        updateDrag({ ...d, at: e.altKey ? p : snapBend(near, p, view.k), moved: true });
        break;
      }
      case 'node': {
        // Snap to other nodes' centers
        const a = FL && !e.altKey ? alignNode(FL, d.id, p.x - d.start.x, p.y - d.start.y, view.k) : { dx: p.x - d.start.x, dy: p.y - d.start.y };
        updateDrag({ ...d, dx: a.dx, dy: a.dy, guideX: a.guideX, guideY: a.guideY, moved: d.moved || moved(d.start) });
        break;
      }
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
        if (d.moved) actions.moveParticipants(d.ids, d.dx, d.dy);
        break;
      case 'stretch':
        if (d.moved) actions.stretchLifeline(d.id, d.dy);
        break;
      case 'diagram':
        if (d.moved) actions.moveDiagram(d.dx, d.dy);
        else {
          // Plain click: select that item
          const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGElement>('[data-kind]');
          const kind = el?.dataset.kind;
          const line = Number(el?.dataset.line);
          if (kind === 'participant') useStore.getState().select({ kind, id: el!.dataset.id! });
          else if (kind === 'message' || kind === 'note') useStore.getState().select({ kind, line });
          else if (kind === 'frame' || kind === 'frame-label') useStore.getState().select({ kind: 'frame', line });
        }
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
      case 'node':
        if (d.moved) flowActions.moveNodes(d.ids, d.dx, d.dy);
        break;
      case 'marquee': {
        const r = rectOf(d.start, d.to);
        // A click on empty canvas clears the selection
        if ((r.x2 - r.x1) * view.k < DRAG_THRESHOLD && (r.y2 - r.y1) * view.k < DRAG_THRESHOLD) {
          if (!d.add) useStore.getState().select(null);
          break;
        }
        const found = itemsInRect(r);
        const keep = d.add ? selectedItems().filter((q) => !found.some((f) => JSON.stringify(f) === JSON.stringify(q))) : [];
        useStore.getState().selectMany([...keep, ...found]);
        break;
      }
      case 'flow-connect': {
        const snap = flowLayout && snapTarget(flowLayout, d.to, view.k, { toward: d.start, free: d.free });
        const travelled = Math.hypot(d.to.x - d.start.x, d.to.y - d.start.y);
        if (snap && (snap.node.id !== d.from || travelled > 30)) flowActions.connectNodes(d.from, snap.node.id, { from: d.fromSide, to: snap.side, toAt: snap.at });
        else if (!snap && travelled > 40) flowActions.connectToNew(d.from, d.to, d.fromSide);
        setFlowHover(null);
        break;
      }
      case 'flow-reconnect': {
        // The end that stays put
        const link = flowLayout?.edges.find((q) => q.index === d.index);
        const toward = link && (d.end === 'to' ? link.points[0] : link.points[link.points.length - 1]);
        const snap = flowLayout && snapTarget(flowLayout, d.to, view.k, { toward, free: d.free });
        if (snap) flowActions.reconnectEdge(d.index, d.end, snap.node.id, snap.side, snap.at);
        // Empty canvas: leave the end there
        else if (Math.hypot(d.to.x - d.start.x, d.to.y - d.start.y) > 8 / view.k) flowActions.detachEdge(d.index, d.end, d.to);
        break;
      }
      case 'flow-bend':
        if (d.moved) flowActions.setEdgeBends(d.index, bendsAfter(d));
        break;
      case 'flow-segment': {
        const FL = flowLayout;
        const e = FL?.edges.find((q) => q.index === d.index);
        if (!e || !d.delta) break;
        const pts = movedRoute(d);
        const [sa, sb] = d.sides;
        const a = FL!.nodes.find((n) => n.id === e.from)!;
        const b = FL!.nodes.find((n) => n.id === e.to)!;
        flowActions.setEdgeRoute(e.index, { from: sa, to: sb, fromAt: e.fromAt ?? sideAt(a, sa, pts[0]), toAt: e.toAt ?? sideAt(b, sb, pts[pts.length - 1]), route: pts.slice(1, -1) });
        break;
      }
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    // Hit test
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const bend = hit?.closest<SVGElement>('[data-handle="bend"]');
    const sel = useStore.getState().selection;
    if (bend && sel?.kind === 'edge') {
      const edge = useStore.getState().flowLayout?.edges.find((q) => q.index === sel.index);
      if (edge) flowActions.setEdgeBends(edge.index, edge.points.slice(1, -1).filter((_, j) => j !== Number(bend.dataset.i)));
      return;
    }
    const el = hit?.closest<SVGElement>('[data-kind]');
    const kind = el?.dataset.kind;
    const line = Number(el?.dataset.line);
    const { setEditing } = useStore.getState();
    if (kind === 'node' || kind === 'subgraph') return setEditing({ kind, id: el!.dataset.id! });
    if (kind === 'edge') return setEditing({ kind, index: Number(el!.dataset.id), line });
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
  const grid = `color-mix(in srgb, ${theme.text} 22%, ${theme.background})`;
  const cursor = panning || drag?.type === 'pan' ? (drag ? 'grabbing' : 'grab') : drag?.type === 'stretch' ? 'ns-resize' : drag?.type === 'statement' || (drag?.type === 'participant' && drag.moved) || drag?.type === 'diagram' || (drag?.type === 'node' && drag.moved) ? 'grabbing' : 'default';
  const hoverNode = flowLayout && !drag && !panning ? flowLayout.nodes.find((n) => n.id === flowHover) : undefined;
  const flowCursor = endHover && !drag && !panning ? 'move' : cursor;

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
        backgroundImage: `radial-gradient(circle, ${grid} ${Math.max(1, 1.2 * k)}px, transparent ${Math.max(1, 1.2 * k) + 0.5}px)`,
        backgroundSize: `${24 * k}px ${24 * k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor: flowCursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => !dragRef.current && (setHover(null), setFlowHover(null), setEndHover(null))}
        onDoubleClick={onDoubleClick}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          <g transform={drag?.type === 'diagram' ? `translate(${drag.dx} ${drag.dy})` : undefined}>
          {drag?.type === 'participant' && drag.moved && <style>{drag.ids.map((id) => `.diagram-main [data-kind="participant"][data-id="${CSS.escape(id)}"]`).join(', ') + ' { opacity: 0.25; }'}</style>}
          {drag?.type === 'statement' && drag.moved && <style>{`.diagram-main [data-line="${drag.line}"] { opacity: 0.25; }`}</style>}
          {drag?.type === 'node' && drag.moved && <style>{drag.ids.map((id) => `.diagram-main [data-kind="node"][data-id="${CSS.escape(id)}"]`).join(', ') + ' { opacity: 0.25; }'}</style>}
          <g className="diagram-main">
            {flowLayout ? <FlowContent layout={flowLayout} theme={theme} background={false} /> : <DiagramContent layout={layout} theme={theme} background={false} />}
          </g>
          {hoverNode && <FlowHandles node={hoverNode} k={k} />}
          {endHover && !drag && !panning && <EndHover point={endHover} k={k} />}
          {/* Link end handles above connect dots */}
          {flowLayout ? <FlowSelectionOverlay layout={flowLayout} selection={selection} k={k} /> : <SelectionOverlay layout={layout} selection={selection} k={k} />}
          {hover && !drag && !panning && (
            <g data-handle="connect" style={{ cursor: 'crosshair' }}>
              <circle cx={hover.x} cy={hover.y} r={12 / k} fill="transparent" />
              <circle cx={hover.x} cy={hover.y} r={6 / k} fill={accent} stroke="white" strokeWidth={1.5 / k} />
              <title>Drag to another lifeline to add a message</title>
            </g>
          )}
          {multi.length > 0 && <GroupOutline items={multi} layout={layout} flow={flowLayout} k={k} />}
          {drag?.type === 'marquee' && <MarqueeBox start={drag.start} to={drag.to} k={k} />}
          {drag && drag.type !== 'marquee' && flowLayout && <FlowDragOverlay drag={drag as FlowDrag} layout={flowLayout} theme={theme} k={k} />}
          {drag && drag.type !== 'marquee' && !flowLayout && <DragOverlay drag={drag} layout={layout} theme={theme} k={k} end={contentEnd(doc.lines)} />}
          </g>
        </g>
      </svg>
      {editing && <InlineEditor target={editing} layout={layout} flow={flowLayout} view={view} fontFamily={theme.fontFamily} ink={inkOf(flowLayout, editing, theme.text)} />}
      <div className={`zoom-controls ${zoomBar}`} role="toolbar" aria-label="Zoom">
        <button className={panMode ? 'active' : ''} aria-pressed={panMode} title="Hand tool (H): drag to pan. Or hold Space, use the middle button, or scroll" aria-label="Hand tool" onClick={() => setPanMode(!panMode)}><Icons.hand /></button>
        <span className="zoom-sep" />
        <button title="Zoom out (-)" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.2)}><Icons.zoomOut /></button>
        <button className="zoom-pct" title="Reset to 100%" aria-label="Reset to 100%" onClick={() => zoomAt(1 / view.k)}>{Math.round(k * 100)}%</button>
        <button title="Zoom in (+)" aria-label="Zoom in" onClick={() => zoomAt(1.2)}><Icons.zoomIn /></button>
        <button title={keys('Fit diagram (⌘0)')} aria-label="Fit diagram" onClick={fit}><Icons.fit /></button>
        <span className="zoom-sep" />
        <button title={zoomBar === 'top' ? 'Move this bar to the bottom' : 'Move this bar to the top'} aria-label={zoomBar === 'top' ? 'Move bar to bottom' : 'Move bar to top'} onClick={() => usePanel.getState().setZoomBar(zoomBar === 'top' ? 'bottom' : 'top')}>
          {zoomBar === 'top' ? <Icons.barDown /> : <Icons.barUp />}
        </button>
      </div>
    </div>
  );
}
