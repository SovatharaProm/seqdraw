import { DIAGRAM_KINDS } from '../core/diagram';
import { Modal } from './components/Modal';
import { HELP_SHORTCUTS } from './shortcuts';
import { keys } from '../lib/platform';

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Help" onClose={onClose}>
      {(close) => (
        <>
          <h2>SeqDraw</h2>
          <p>
            Write <a href={DIAGRAM_KINDS.sequence.docs} target="_blank" rel="noreferrer">Mermaid sequence diagram</a> or{' '}
            <a href={DIAGRAM_KINDS.flowchart.docs} target="_blank" rel="noreferrer">flowchart</a> code on the left, or draw on the canvas.
            Each one updates the other.
          </p>
          <p>
            Your work is kept in this browser, so reloading the page brings it back. Use <em>Save</em> to keep a <code>.seqd</code> file on your computer
            and <em>Open</em> it later to continue. Editable PNG/SVG exports can be reopened too.
          </p>
          <table>
            <tbody>
              {HELP_SHORTCUTS.map(([k, v]) => (
                <tr key={k}>
                  <td><kbd>{keys(k)}</kbd></td>
                  <td>{keys(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={close}>Close</button>
        </>
      )}
    </Modal>
  );
}
