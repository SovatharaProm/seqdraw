import { useEffect, useState } from 'react';
import { isBlankDiagram } from '../core/diagram';
import { getEditorView } from '../editor/CodeEditor';
import { usePanel } from '../state/panel';
import { useStore } from '../state/store';

// Gestures that dismiss the hint: pan, zoom, hand tool, dragging a shape
const DISMISS_EVENTS = ['pointerdown', 'wheel', 'dragstart'] as const;

// Blank canvas hint
export function EmptyHint() {
  const blank = useStore((s) => isBlankDiagram(s.pending ?? s.code));
  const open = usePanel((s) => s.open);
  const [dismissed, setDismissed] = useState(false);

  // Back for the next blank diagram
  useEffect(() => {
    if (!blank) setDismissed(false);
  }, [blank]);

  useEffect(() => {
    if (!blank || dismissed) return;
    const onEvent = (e: Event) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.canvas-pane') && !t.closest('.empty-hint')) setDismissed(true);
    };
    DISMISS_EVENTS.forEach((n) => window.addEventListener(n, onEvent, true));
    return () => DISMISS_EVENTS.forEach((n) => window.removeEventListener(n, onEvent, true));
  }, [blank, dismissed]);

  if (!blank) return null;
  const write = () => {
    usePanel.getState().setOpen(true);
    requestAnimationFrame(() => getEditorView()?.focus());
  };
  return (
    <div className={`empty-hint${dismissed ? ' hidden' : ''}`} aria-hidden={dismissed}>
      <strong>Draw or write your diagram</strong>
      <span>Drag a shape from the dock below, or type Mermaid code. Sequence diagrams and flowcharts are recognized automatically.</span>
      {!open && <button onClick={write}>Write code instead</button>}
    </div>
  );
}
