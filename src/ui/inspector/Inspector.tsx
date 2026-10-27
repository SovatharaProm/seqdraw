// Properties of the selection
import { useStore } from '../../state/store';
import { FlowInspector } from './FlowInspector';
import { GroupPanel } from './GroupPanel';
import { SequenceInspector } from './SequenceInspector';

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const count = useStore((s) => s.multi.length);
  const isFlow = useStore((s) => s.flow !== null);
  if (count) return <GroupPanel count={count} />;
  if (!selection) return null;
  return isFlow ? <FlowInspector selection={selection} /> : <SequenceInspector selection={selection} />;
}
