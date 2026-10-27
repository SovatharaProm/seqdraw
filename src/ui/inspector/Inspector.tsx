// Properties of the selection
import { useStore } from '../../state/store';
import { FlowInspector } from './FlowInspector';
import { SequenceInspector } from './SequenceInspector';

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const isFlow = useStore((s) => s.flow !== null);
  if (!selection) return null;
  return isFlow ? <FlowInspector selection={selection} /> : <SequenceInspector selection={selection} />;
}
