import { isBlankDiagram } from '../core/diagram';
import { useStore } from '../state/store';
import { usePanel } from '../state/panel';
import { exportAs } from './fileActions';
import { Modal } from './components/Modal';

const opts = { embed: false, scale: 1 };

// Generated code dialog
export function GetCodeDialog({ onClose }: { onClose: () => void }) {
  const code = useStore((s) => s.code);
  const blank = isBlankDiagram(code);
  return (
    <Modal label="Mermaid code" className="get-code" onClose={onClose}>
      {(close) => (
        <>
          <h2>Mermaid code</h2>
          <p>{blank ? 'Nothing drawn yet. Add a shape and its code appears here.' : 'Generated from your drawing. Paste it anywhere Mermaid runs: GitHub, GitLab, Notion, docs.'}</p>
          <pre className="get-code-text">{code || ' '}</pre>
          <div className="get-code-actions">
            <button className="primary" disabled={blank} onClick={() => (exportAs('copy-code', opts), close())}>Copy code</button>
            <button disabled={blank} onClick={() => (exportAs('copy-markdown', opts), close())}>Copy as Markdown</button>
            <span className="spacer" />
            <button onClick={() => usePanel.getState().setOpen(true)}>Edit code</button>
            <button onClick={close}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}
