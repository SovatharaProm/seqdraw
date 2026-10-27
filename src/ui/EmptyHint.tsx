import { isBlankDiagram } from '../core/diagram';
import { getEditorView } from '../editor/CodeEditor';
import { usePanel } from '../state/panel';
import { useStore } from '../state/store';

// Blank canvas hint
export function EmptyHint() {
  const blank = useStore((s) => isBlankDiagram(s.pending ?? s.code));
  const open = usePanel((s) => s.open);
  if (!blank) return null;
  const write = () => {
    usePanel.getState().setOpen(true);
    requestAnimationFrame(() => getEditorView()?.focus());
  };
  return (
    <div className="empty-hint">
      <strong>Draw or write your diagram</strong>
      <span>Drag a shape from the dock below, or type Mermaid code. Sequence diagrams and flowcharts are recognized automatically.</span>
      {!open && <button onClick={write}>Write code instead</button>}
    </div>
  );
}
