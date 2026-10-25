import { useState } from 'react';
import { useStore } from '../state/store';
import { Icons } from '../ui/icons';
import { getEditorView } from './CodeEditor';
import { SNIPPET_GROUPS, SNIPPETS, insertSnippet, type Snippet } from './snippets';

const DOCS_URL = 'https://mermaid.js.org/syntax/sequenceDiagram.html';

export type EditorTab = 'code' | 'snippets';

// Editor header
export function EditorHeader({ tab, onTab, onClose }: { tab: EditorTab; onTab: (t: EditorTab) => void; onClose: () => void }) {
  const autoUpdate = useStore((s) => s.autoUpdate);
  const pending = useStore((s) => s.pending !== null);
  const { setAutoUpdate, flush } = useStore.getState();
  return (
    <div className="editor-header">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'code'} className={tab === 'code' ? 'on' : ''} onClick={() => onTab('code')}>
          <Icons.code /> Code
        </button>
        <button role="tab" aria-selected={tab === 'snippets'} className={tab === 'snippets' ? 'on' : ''} onClick={() => onTab('snippets')}>
          <Icons.brackets /> Snippets
        </button>
      </div>
      <span className="spacer" />
      {!autoUpdate && (
        <button className="header-btn run" onClick={flush} disabled={!pending} title="Update the diagram (⌘↵)">
          <Icons.play /> Run
        </button>
      )}
      <label className="switch" title="Redraw the diagram while you type">
        <button role="switch" aria-checked={autoUpdate} className={autoUpdate ? 'on' : ''} onClick={() => setAutoUpdate(!autoUpdate)}>
          <span />
        </button>
        Live
      </label>
      <a className="header-btn icon" href={DOCS_URL} target="_blank" rel="noreferrer" title="Mermaid sequence diagram docs" aria-label="Docs">
        <Icons.book />
      </a>
      <button className="header-btn icon" onClick={onClose} title="Hide code" aria-label="Hide code">
        <Icons.chevronLeft />
      </button>
    </div>
  );
}

// Snippet preview
const preview = (s: Snippet) => s.template('A', 'B').replace(/\$\{\d+:([^}]*)\}/g, '$1');

// Snippet list
export function SnippetPanel({ onInserted }: { onInserted: () => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const match = (s: Snippet) => !q || `${s.label} ${s.keyword} ${s.detail}`.toLowerCase().includes(q);
  const insert = (s: Snippet) => {
    const view = getEditorView();
    if (!view) return;
    onInserted();
    requestAnimationFrame(() => insertSnippet(view, s));
  };

  return (
    <section className="snippets" aria-label="Snippets">
      <input className="snippet-search" placeholder="Filter snippets…" value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false} />
      <div className="snippets-body">
        {SNIPPET_GROUPS.map((g) => {
          const items = SNIPPETS.filter((s) => s.group === g && match(s));
          if (!items.length) return null;
          return (
            <div key={g} className="snippet-group">
              <div className="snippet-group-title">{g}</div>
              {items.map((s) => {
                const Glyph = Icons[s.icon];
                return (
                  <button key={s.id} className="snippet-row" onClick={() => insert(s)} title={`${s.detail}. Inserts at the cursor.`}>
                    <span className="snippet-icon"><Glyph /></span>
                    <span className="snippet-label">{s.label}</span>
                    <code>{preview(s).split('\n')[0]}</code>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
