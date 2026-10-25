import { useEffect, useRef, useState } from 'react';
import { Canvas, requestFit } from './canvas/Canvas';
import { CodeEditor } from './editor/CodeEditor';
import { EditorHeader, SnippetPanel, type EditorTab } from './editor/SnippetMenu';
import { useStore } from './state/store';
import { loadFile, openDialog, save } from './ui/fileActions';
import { Icons } from './ui/icons';
import { Inspector } from './ui/Inspector';
import { Palette } from './ui/Palette';
import { useToasts } from './ui/toast';
import { ThemeBadge } from './ui/ThemeBadge';
import { Toolbar } from './ui/Toolbar';

const CODE_KEY = 'seqdraw.code.open';

function readCodeOpen() {
  try {
    return localStorage.getItem(CODE_KEY) !== '0';
  } catch {
    return true;
  }
}

const SHORTCUTS: [string, string][] = [
  ['Drag empty canvas / Space+drag', 'Pan'],
  ['Scroll', 'Pan'],
  ['⌘/Ctrl + scroll, pinch, + / −', 'Zoom'],
  ['⌘0', 'Fit diagram to screen'],
  ['Hover a lifeline, drag to another', 'Draw a message'],
  ['Drag a participant sideways', 'Reorder / re-space'],
  ['Drag a message or note', 'Up/down reorders (also into or out of blocks); sideways moves it to other lifelines'],
  ['Drag a block label (loop, alt, …)', 'Move the whole block with its contents'],
  ['Drag the ● ends of a selected message', 'Reconnect it'],
  ['Drag the □ corner of a selected participant', 'Resize'],
  ['Double-click, Enter or F2', 'Edit text'],
  ['Shift+Enter while editing', 'New line'],
  ['Delete / Backspace', 'Delete selection'],
  ['⌘Z / ⇧⌘Z', 'Undo / redo'],
  ['⌘S / ⌘O', 'Save / open'],
  ['⌘↵ in the code editor', 'Update the diagram (when Auto-Update is off)'],
];

function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Help" onClick={(e) => e.stopPropagation()}>
        <h2>SeqDraw</h2>
        <p>
          Write <a href="https://mermaid.js.org/syntax/sequenceDiagram.html" target="_blank" rel="noreferrer">Mermaid sequence diagram</a> code
          on the left, or draw on the canvas. Each one updates the other.
        </p>
        <p>
          Your work is kept in this browser, so reloading the page brings it back. Use <em>Save</em> to keep a <code>.seqd</code> file on your computer
          and <em>Open</em> it later to continue. Editable PNG/SVG exports can be reopened too.
        </p>
        <table>
          <tbody>
            {SHORTCUTS.map(([k, v]) => (
              <tr key={k}>
                <td><kbd>{k}</kbd></td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// Status bar
function StatusBar() {
  const errors = useStore((s) => s.doc.errors);
  const doc = useStore((s) => s.doc);
  const pending = useStore((s) => s.pending !== null);
  if (errors.length) {
    const e = errors[0];
    return (
      <div className="status error" role="status" title={errors.map((x) => `Syntax error Line ${x.line + 1}: ${x.message}`).join('\n')}>
        <Icons.error />
        <span>
          <b>Syntax error</b> Line {e.line + 1}: {e.message}
          {errors.length > 1 && ` (+${errors.length - 1} more)`}
        </span>
      </div>
    );
  }
  const messages = doc.lines.filter((l) => l.stmt.type === 'message').length;
  return (
    <div className="status" role="status">
      <span>{doc.participants.length} participants · {messages} messages</span>
      <span className="spacer" />
      {pending && <span className="status-pending">Changes not drawn · ⌘↵</span>}
    </div>
  );
}

export default function App() {
  const [help, setHelp] = useState(false);
  const [split, setSplit] = useState(34); // editor width %
  const [codeOpen, setCodeOpen] = useState(readCodeOpen);
  const [dropping, setDropping] = useState(false);
  const [tab, setTab] = useState<EditorTab>('code');
  const toasts = useToasts((s) => s.toasts);
  const main = useRef<HTMLDivElement>(null);

  // Code panel toggle
  useEffect(() => {
    try {
      localStorage.setItem(CODE_KEY, codeOpen ? '1' : '0');
    } catch {
      // ignore
    }
    requestAnimationFrame(requestFit);
  }, [codeOpen]);
  const closeCode = () => {
    useStore.getState().flush();
    setCodeOpen(false);
  };

  // Global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      const { undo, redo } = useStore.getState();
      if (k === 's') (e.preventDefault(), save(e.shiftKey));
      else if (k === 'o') (e.preventDefault(), openDialog());
      else if (k === 'z' && !e.shiftKey) (e.preventDefault(), undo());
      else if ((k === 'z' && e.shiftKey) || k === 'y') (e.preventDefault(), redo());
      else if (k === '0') (e.preventDefault(), requestFit());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // File drop
  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files');
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDropping(true);
    };
    const leave = (e: DragEvent) => !e.relatedTarget && setDropping(false);
    const drop = (e: DragEvent) => {
      setDropping(false);
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      e.preventDefault();
      loadFile(file);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const startResize = (e: React.PointerEvent) => {
    const rect = main.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => setSplit(Math.min(70, Math.max(15, ((ev.clientX - rect.left) / rect.width) * 100)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  };

  return (
    <div className="app">
      <Toolbar onHelp={() => setHelp(true)} />
      <main ref={main} className={codeOpen ? '' : 'code-closed'} style={{ ['--split' as string]: `${split}%` }}>
        {codeOpen && (
          <>
            <section className="editor-pane" aria-label="Code">
              <EditorHeader tab={tab} onTab={setTab} onClose={closeCode} />
              <div className={`editor-body ${tab === 'code' ? '' : 'hidden'}`}>
                <CodeEditor />
              </div>
              {tab === 'snippets' && <SnippetPanel onInserted={() => setTab('code')} />}
              <StatusBar />
            </section>
            <div className="splitter" onPointerDown={startResize} role="separator" aria-orientation="vertical" />
          </>
        )}
        <section className="canvas-pane" aria-label="Diagram">
          <Canvas />
          <Palette />
          <Inspector />
          <ThemeBadge />
          {!codeOpen && (
            <button className="code-open" onClick={() => setCodeOpen(true)} title="Show code">
              <Icons.code /> Code
            </button>
          )}
        </section>
      </main>
      {help && <Help onClose={() => setHelp(false)} />}
      {dropping && <div className="drop-overlay">Drop a .seqd, .mmd, or editable PNG/SVG file to open it</div>}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}
