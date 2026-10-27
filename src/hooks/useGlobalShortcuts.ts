import { useEffect } from 'react';
import { requestFit } from '../canvas/Canvas';
import { useStore } from '../state/store';
import { openDialog, save } from '../ui/fileActions';

// ⌘ key bindings
const BINDINGS: { match: (k: string, e: KeyboardEvent) => boolean; run: (e: KeyboardEvent) => void }[] = [
  { match: (k) => k === 's', run: (e) => save(e.shiftKey) },
  { match: (k) => k === 'o', run: () => openDialog() },
  { match: (k, e) => k === 'z' && !e.shiftKey, run: () => useStore.getState().undo() },
  { match: (k, e) => (k === 'z' && e.shiftKey) || k === 'y', run: () => useStore.getState().redo() },
  { match: (k) => k === '0', run: () => requestFit() },
];

export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      const b = BINDINGS.find((q) => q.match(k, e));
      if (!b) return;
      e.preventDefault();
      b.run(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
