import { isFreeEnd } from '../flow/shapes';
import { useStore } from '../state/store';
import { CodeZoom } from './CodeZoom';
import { Icons } from '../ui/icons';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Diagram summary
function useSummary(): string {
  return useStore((s) => {
    if (s.flow) return `${plural(s.flow.nodes.filter((n) => !isFreeEnd(n)).length, 'node')} · ${plural(s.flow.edges.length, 'link')}`;
    const messages = s.doc.lines.filter((l) => l.stmt.type === 'message').length;
    return `${s.doc.participants.length} participants · ${messages} messages`;
  });
}

// Under the editor: errors or counts, code size
export function StatusBar() {
  const errors = useStore((s) => s.doc.errors);
  const pending = useStore((s) => s.pending !== null);
  const summary = useSummary();
  if (errors.length) {
    const e = errors[0];
    return (
      <div className="status error" role="status" title={errors.map((x) => `Syntax error Line ${x.line + 1}: ${x.message}`).join('\n')}>
        <Icons.error />
        <span>
          <b>Syntax error</b> Line {e.line + 1}: {e.message}
          {errors.length > 1 && ` (+${errors.length - 1} more)`}
        </span>
        <span className="spacer" />
        <CodeZoom />
      </div>
    );
  }
  return (
    <div className="status" role="status">
      <span>{summary}</span>
      <span className="spacer" />
      {pending && <span className="status-pending">Changes not drawn · ⌘↵</span>}
      <CodeZoom />
    </div>
  );
}
