import { THEMES } from '../core/themes';
import { useStore } from '../state/store';
import { Icons } from './icons';
import { Menu } from './Menu';

const GROUPS = ['SeqDraw', 'Classic', 'Redux', 'Neo'] as const;

// Theme badge
export function ThemeBadge() {
  const theme = useStore((s) => s.theme);
  const { setTheme } = useStore.getState();
  return (
    <div className="theme-badge">
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
