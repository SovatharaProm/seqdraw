import { useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { EXAMPLES } from './examples';
import { useAppearance, type Appearance } from '../state/appearance';
import { Icons, Logo } from './icons';
import { IconButton } from './components/Button';
import { Menu } from './components/Menu';
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

const QUALITY: [number, string][] = [
  [1, 'Standard'],
  [2, 'Sharp'],
  [3, 'Sharper'],
  [4, 'Print'],
];

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
    <Menu label={<><Icons.export /> Export</>} title="Download or copy the diagram">
      {(close) => (
        <>
          <div className="menu-section">Image</div>
          {item('png', 'PNG', QUALITY.find(([s]) => s === scale)![1].toLowerCase(), close)}
          {item('png-transparent', 'PNG (transparent)', 'no background', close)}
          {item('svg', 'SVG', 'vector, scalable', close)}
          {item('pdf', 'PDF', 'vector, print-ready', close)}
          <div className="menu-options">
            <label className="menu-option" title="Hide the project inside the image so you can drop it back into SeqDraw and keep editing">
              <input type="checkbox" checked={embed} onChange={(e) => setEmbed(e.target.checked)} />
              <span>
                Keep editable
                <small>Reopen the PNG/SVG in SeqDraw later. Turn off to share only the picture.</small>
              </span>
            </label>
            <label className="menu-option stack">
              <span className="menu-option-row">
                PNG quality
                <select value={scale} onChange={(e) => setScale(+e.target.value)}>
                  {QUALITY.map(([s, name]) => (
                    <option key={s} value={s}>{name} {s}×</option>
                  ))}
                </select>
              </span>
              <small>Higher is sharper, but a bigger file. SVG and PDF are always sharp.</small>
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
        <Menu label={<><Icons.newFile /> New</>} title="Start a new diagram">
          {(close) => (
            <>
              <div className="menu-section">Blank</div>
              <button className="menu-item" onClick={() => (close(), newDiagram('', 'untitled', 'draw'))}>
                <span>Draw</span>
                <small>shapes on the canvas</small>
              </button>
              <button className="menu-item" onClick={() => (close(), newDiagram('', 'untitled', 'code'))}>
                <span>Write code</span>
                <small>Mermaid syntax</small>
              </button>
              {(['Sequence', 'Flowchart'] as const).map((group) => (
                <div key={group}>
                  <div className="menu-section">{group === 'Sequence' ? 'Sequence diagrams' : 'Flowcharts'}</div>
                  {EXAMPLES.filter((ex) => ex.group === group).map((ex) => (
                    <button key={ex.name} className="menu-item" onClick={() => (close(), newDiagram(ex.code))}>
                      <span>{ex.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </Menu>
        <button onClick={openDialog} title="Open a .seqd, .mmd, or editable PNG/SVG file (⌘O)"><Icons.folder /> Open</button>
        <button className="primary" onClick={() => save()} title="Save a .seqd file you can reopen later (⌘S)"><Icons.save /> Save</button>
        <ExportMenu />
      </div>

      <div className="tool-group">
        <IconButton label="Undo" shortcut="⌘Z" onClick={undo} disabled={!canUndo}><Icons.undo /></IconButton>
        <IconButton label="Redo" shortcut="⇧⌘Z" onClick={redo} disabled={!canRedo}><Icons.redo /></IconButton>
      </div>

      <div className="spacer" />
      <AppearanceMenu />
      <IconButton label="Help & shortcuts" onClick={onHelp}><Icons.help /></IconButton>
    </header>
  );
}
