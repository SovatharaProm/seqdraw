import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { requestFit } from '../lib/fit';
import { SPLIT, usePanel } from '../state/panel';

// Code / canvas divider
export function Splitter({ container }: { container: RefObject<HTMLElement | null> }) {
  const { setSplit } = usePanel.getState();
  const start = (e: ReactPointerEvent) => {
    const rect = container.current!.getBoundingClientRect();
    const at = (ev: PointerEvent) => ((ev.clientX - rect.left) / rect.width) * 100;
    const move = (ev: PointerEvent) => setSplit(at(ev), false);
    const up = (ev: PointerEvent) => {
      setSplit(at(ev));
      requestAnimationFrame(requestFit);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  };
  return <div className="splitter" onPointerDown={start} onDoubleClick={() => setSplit(SPLIT)} role="separator" aria-orientation="vertical" title="Drag to resize the code panel, double-click to reset" />;
}
