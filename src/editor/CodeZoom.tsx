import type { KeyboardEvent } from 'react';
import { getEditorView } from './CodeEditor';
import { CODE_SIZE, CODE_SIZE_RANGE, usePanel } from '../state/panel';

function setSize(size: number) {
  usePanel.getState().setSize(size);
  requestAnimationFrame(() => getEditorView()?.requestMeasure());
}

// ⌘+ / ⌘- / ⌘0 inside the code panel
export function codeZoomKey(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey)) return;
  const { size } = usePanel.getState();
  if (e.key === '=' || e.key === '+') setSize(size + 1);
  else if (e.key === '-') setSize(size - 1);
  else if (e.key === '0') setSize(CODE_SIZE);
  else return;
  e.preventDefault();
  e.stopPropagation();
}

// Code text size
export function CodeZoom() {
  const size = usePanel((s) => s.size);
  return (
    <span className="code-zoom" role="group" aria-label="Code text size">
      <button onClick={() => setSize(size - 1)} disabled={size <= CODE_SIZE_RANGE[0]} title="Smaller code text (⌘−)" aria-label="Smaller code text">−</button>
      <button className="code-zoom-pct" onClick={() => setSize(CODE_SIZE)} title="Reset code text size (⌘0)">{Math.round((size / CODE_SIZE) * 100)}%</button>
      <button onClick={() => setSize(size + 1)} disabled={size >= CODE_SIZE_RANGE[1]} title="Larger code text (⌘+)" aria-label="Larger code text">+</button>
    </span>
  );
}
