import { useState } from 'react';
import { usePanel } from '../state/panel';
import { codeZoomKey } from './CodeZoom';
import { CodeEditor } from './CodeEditor';
import { EditorHeader, SnippetPanel, type EditorTab } from './SnippetMenu';
import { StatusBar } from './StatusBar';

// Code panel: tabs, editor or snippets, status
export function EditorPane() {
  const [tab, setTab] = useState<EditorTab>('code');
  const size = usePanel((s) => s.size);
  return (
    <section className="editor-pane" aria-label="Code" style={{ ['--code-size' as string]: `${size}px` }} onKeyDown={codeZoomKey}>
      <EditorHeader tab={tab} onTab={setTab} onClose={() => usePanel.getState().setOpen(false)} />
      <div className={`editor-body ${tab === 'code' ? '' : 'hidden'}`}>
        <CodeEditor />
      </div>
      {tab === 'snippets' && <SnippetPanel onInserted={() => setTab('code')} />}
      <StatusBar />
    </section>
  );
}
