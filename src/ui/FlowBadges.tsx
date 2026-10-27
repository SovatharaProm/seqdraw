import type { ReactNode } from 'react';
import type { FlowDir } from '../flow/model';
import { LAYOUT_ENGINES, engineOf, type LayoutEngine } from '../flow/elk';
import { autoLayout, hasPositions, setFlowDirection, setLayoutEngine } from '../state/flowActions';
import { Icons } from './icons';
import { useStore } from '../state/store';
import { Menu } from './components/Menu';

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
    <Menu label={<span className="menu-icon">{cur.label} <span aria-hidden>{cur.arrow}</span></span>} title="Flowchart direction (written into the header line)" align="right" caret={false}>
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

const ENGINE_ICONS: Record<LayoutEngine, () => ReactNode> = { dagre: Icons.hierarchical, elk: Icons.adaptive };

// Hierarchical / Adaptive
function LayoutMenu() {
  const engine = useStore((s) => (s.flow ? engineOf(s.flow) : null));
  if (!engine) return null;
  const cur = LAYOUT_ENGINES.find((e) => e.id === engine)!;
  const CurIcon = ENGINE_ICONS[engine];
  return (
    <Menu label={<span className="menu-icon">{cur.name} <CurIcon /></span>} title="Flowchart layout (written into the code's config, like Mermaid)" align="right" caret={false}>
      {(close) => (
        <>
          <div className="menu-section">Layout</div>
          {LAYOUT_ENGINES.map((e) => {
            const Icon = ENGINE_ICONS[e.id];
            return (
              <button key={e.id} className={`menu-item rich ${e.id === engine ? 'checked' : ''}`} aria-pressed={e.id === engine} onClick={() => (close(), setLayoutEngine(e.id))}>
                <span className="menu-rich-head">{e.name} <Icon /></span>
                <small>{e.hint}</small>
              </button>
            );
          })}
        </>
      )}
    </Menu>
  );
}

// Top-right of the canvas: layout and direction (flowcharts only)
export function FlowBadges() {
  return (
    <div className="canvas-badge">
      <LayoutMenu />
      <DirectionMenu />
    </div>
  );
}
