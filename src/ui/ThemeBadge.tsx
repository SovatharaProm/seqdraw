import { THEMES } from '../core/themes';
import type { FlowDir } from '../flow/model';
import { autoLayout, hasPositions, setFlowDirection } from '../state/flowActions';
import { useStore } from '../state/store';
import { Icons } from './icons';
import { Menu } from './components/Menu';

const GROUPS = ['SeqDraw', 'Classic', 'Redux', 'Neo'] as const;

const DIRECTIONS: { dir: FlowDir; label: string; arrow: string }[] = [
  { dir: 'TD', label: 'Top to bottom', arrow: '↓' },
  { dir: 'BT', label: 'Bottom to top', arrow: '↑' },
  { dir: 'LR', label: 'Left to right', arrow: '→' },
  { dir: 'RL', label: 'Right to left', arrow: '←' },
];

// Flowchart direction
function DirectionMenu() {
  const dir = useStore((s) => s.flow?.dir);
  const placed = useStore((s) => hasPositions(s.overrides));
  if (!dir) return null;
  const cur = DIRECTIONS.find((d) => d.dir === dir || (dir === 'TB' && d.dir === 'TD'))!;
  return (
    <Menu label={<span className="menu-icon">{cur.arrow} {dir}</span>} title="Flowchart direction (written into the header line)" align="right" caret={false}>
      {(close) =>
        DIRECTIONS.map((d) => (
          <button key={d.dir} className={`menu-item ${d === cur ? 'checked' : ''}`} aria-pressed={d === cur} onClick={() => (close(), setFlowDirection(d.dir))}>
            <span>{d.arrow} {d.label}</span>
            <small>{d.dir}</small>
          </button>
        )).concat(
          <div key="auto">
            <div className="menu-section">Layout</div>
            <button className="menu-item" disabled={!placed} onClick={() => (close(), autoLayout())} title="Forget hand-placed positions and lay out like Mermaid">
              <span>Auto layout</span>
              <small>{placed ? 're-arrange' : 'on'}</small>
            </button>
          </div>,
        )
      }
    </Menu>
  );
}

// Theme badge
export function ThemeBadge() {
  const theme = useStore((s) => s.theme);
  const { setTheme } = useStore.getState();
  return (
    <div className="theme-badge">
      <DirectionMenu />
      <Menu label={<span className="menu-icon">{THEMES[theme].name} theme <Icons.theme /></span>} title="Diagram theme (written into the code's config block, like Mermaid)" align="right" caret={false}>
        {(close) =>
          GROUPS.map((group) => (
            <div key={group}>
              <div className="menu-section">{group}</div>
              {Object.entries(THEMES)
                .filter(([, t]) => t.group === group)
                .map(([id, t]) => (
                  <button key={id} className={`menu-item ${id === theme ? 'checked' : ''}`} aria-pressed={id === theme} onClick={() => (close(), setTheme(id))}>
                    <span>{t.name}</span>
                    <small>{id}</small>
                  </button>
                ))}
            </div>
          ))
        }
      </Menu>
    </div>
  );
}
