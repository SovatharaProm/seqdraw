import { useRef, useState } from 'react';
import { Canvas } from './canvas/Canvas';
import { EditorPane } from './editor/EditorPane';
import { useFileDrop } from './hooks/useFileDrop';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { usePanel } from './state/panel';
import { loadFile } from './ui/fileActions';
import { EmptyHint } from './ui/EmptyHint';
import { GetCodeDialog } from './ui/GetCodeDialog';
import { HelpDialog } from './ui/HelpDialog';
import { Icons } from './ui/icons';
import { Inspector } from './ui/inspector/Inspector';
import { Palette } from './ui/Palette';
import { Splitter } from './ui/Splitter';
import { ThemeBadge } from './ui/ThemeBadge';
import { Toasts } from './ui/Toasts';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  const [help, setHelp] = useState(false);
  const codeOpen = usePanel((s) => s.open);
  const getCode = usePanel((s) => s.getCode);
  const split = usePanel((s) => s.split);
  const { setGetCode } = usePanel.getState();
  const main = useRef<HTMLElement>(null);
  const dropping = useFileDrop(loadFile);
  useGlobalShortcuts();

  return (
    <div className="app">
      <Toolbar onHelp={() => setHelp(true)} />
      <main ref={main} className={codeOpen ? '' : 'code-closed'} style={{ ['--split' as string]: `${split}%` }}>
        {codeOpen && (
          <>
            <EditorPane />
            <Splitter container={main} />
          </>
        )}
        <section className="canvas-pane" aria-label="Diagram">
          <Canvas />
          <Palette />
          <Inspector />
          <ThemeBadge />
          <EmptyHint />
          {!codeOpen && (
            <button className="code-open" onClick={() => setGetCode(true)} title="See the Mermaid code for this diagram">
              <Icons.code /> Get code
            </button>
          )}
        </section>
      </main>
      {help && <HelpDialog onClose={() => setHelp(false)} />}
      {getCode && <GetCodeDialog onClose={() => setGetCode(false)} />}
      {dropping && <div className="drop-overlay">Drop a .seqd, .mmd, or editable PNG/SVG file to open it</div>}
      <Toasts />
    </div>
  );
}
