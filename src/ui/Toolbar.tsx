import { useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { EXAMPLES } from './examples';
import { useAppearance, type Appearance } from './appearance';
import { Icons, Logo } from './icons';
import { Menu } from './Menu';
import { exportAs, newDiagram, openDialog, save, type ExportFormat } from './fileActions';

const APPEARANCES: { value: Appearance; label: string; Icon: () => ReactNode }[] = [
  { value: 'system', label: 'System', Icon: Icons.monitor },
  { value: 'light', label: 'Light', Icon: Icons.sun },
  { value: 'dark', label: 'Dark', Icon: Icons.moon },
];

function AppearanceMenu() {
  const appearance = useAppearance((s) => s.appearance);
  const setAppearance = useAppearance((s) => s.setAppearance);
  const Current = APPEARANCES.find((a) => a.value === appearance)!.Icon;
  return (
    <Menu label={<Current />} title="Appearance" align="right" caret={false}>
      {(close) =>
        APPEARANCES.map(({ value, label, Icon }) => (
          <button key={value} className={`menu-item ${value === appearance ? 'checked' : ''}`} aria-pressed={value === appearance} onClick={() => (close(), setAppearance(value))}>
            <span className="menu-icon"><Icon /> {label}</span>
          </button>
        ))
      }
    </Menu>
  );
}

function ExportMenu() {
  const [embed, setEmbed] = useState(true);
  const [scale, setScale] = useState(2);
  const item = (format: ExportFormat, label: string, hint: string, close: () => void) => (
    <button
      className="menu-item"
      onClick={() => {
        close();
        exportAs(format, { embed, scale });
      }}
    >
      <span>{label}</span>
      <small>{hint}</small>
    </button>
  );
  return (
    <Menu label="Export" title="Download or copy the diagram">
      {(close) => (
        <>
          <div className="menu-section">Image</div>
          {item('png', 'PNG', `${scale}× resolution`, close)}
          {item('png-transparent', 'PNG (transparent)', 'no background', close)}
          {item('svg', 'SVG', 'vector, scalable', close)}
          {item('pdf', 'PDF', 'vector, print-ready', close)}
          <div className="menu-options">
            <label title="Store the diagram inside the PNG/SVG so it can be opened again in SeqDraw and edited">
              <input type="checkbox" checked={embed} onChange={(e) => setEmbed(e.target.checked)} /> Editable PNG/SVG
            </label>
            <label>
              Scale{' '}
              <select value={scale} onChange={(e) => setScale(+e.target.value)}>
                {[1, 2, 3, 4].map((s) => (
                  <option key={s} value={s}>{s}×</option>
                ))}
              </select>
            </label>
          </div>
          <div className="menu-section">Code</div>
          {item('mmd', 'Mermaid file (.mmd)', 'plain text', close)}
          {item('copy-code', 'Copy Mermaid code', 'clipboard', close)}
          {item('copy-markdown', 'Copy as Markdown', '```mermaid block', close)}
          {item('copy-svg', 'Copy SVG markup', 'clipboard', close)}
        </>
      )}
    </Menu>
  );
}

export function Toolbar({ onHelp }: { onHelp: () => void }) {
  const fileName = useStore((s) => s.fileName);
  const dirty = useStore((s) => s.dirty);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const { undo, redo, setFileName } = useStore.getState();

  return (
    <header className="toolbar">
      <div className="brand">
        <Logo />
        <span>SeqDraw</span>
      </div>
      <div className="file-name">
        <input value={fileName} onChange={(e) => setFileName(e.target.value)} aria-label="Diagram name" spellCheck={false} />
        {dirty && <span className="dirty" title="Unsaved changes">●</span>}
      </div>

      <div className="tool-group">
        <Menu label="New" title="Start a new diagram">
          {(close) =>
            EXAMPLES.map((ex) => (
              <button key={ex.name} className="menu-item" onClick={() => (close(), newDiagram(ex.code))}>
                <span>{ex.name}</span>
              </button>
            ))
          }
        </Menu>
        <button onClick={openDialog} title="Open a .seqd, .mmd, or editable PNG/SVG file (⌘O)">Open</button>
        <button className="primary" onClick={() => save()} title="Save a .seqd file you can reopen later (⌘S)">Save</button>
        <ExportMenu />
      </div>

      <div className="tool-group">
        <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)" aria-label="Undo"><Icons.undo /></button>
        <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Redo (⇧⌘Z)" aria-label="Redo"><Icons.redo /></button>
      </div>

      <div className="spacer" />
      <AppearanceMenu />
      <button className="icon-btn" onClick={onHelp} title="Help & shortcuts" aria-label="Help"><Icons.help /></button>
    </header>
  );
}
