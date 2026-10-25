import { PARTICIPANT_SHAPES } from '../core/participants';
import { addItem, type PaletteItem } from '../state/actions';
import { Icons } from './icons';

const GROUPS: { title: string; items: { item: PaletteItem; label: string; hint: string }[] }[] = [
  {
    title: 'Participants',
    items: PARTICIPANT_SHAPES.map((s) => ({ item: s.kind, label: s.name, hint: s.hint })),
  },
  {
    title: 'Interactions',
    items: [
      { item: 'message', label: 'Message', hint: 'You can also drag between two lifelines' },
      { item: 'note', label: 'Note', hint: 'Drop next to or on a lifeline' },
    ],
  },
  {
    title: 'Fragments',
    items: [
      { item: 'loop', label: 'Loop', hint: 'Repeat block' },
      { item: 'alt', label: 'Alt', hint: 'If / else block' },
      { item: 'opt', label: 'Opt', hint: 'Optional block' },
      { item: 'par', label: 'Par', hint: 'Parallel block' },
      { item: 'critical', label: 'Critical', hint: 'Critical region' },
      { item: 'break', label: 'Break', hint: 'Break out of the flow' },
    ],
  },
];

// Shape strip
export function Palette() {
  return (
    <aside className="palette" aria-label="Shapes">
      {GROUPS.map((g) => (
        <div key={g.title} className="palette-group" role="group" aria-label={g.title}>
          {g.items.map(({ item, label, hint }) => {
            const Glyph = Icons[item];
            return (
              <button
                key={item}
                className="palette-item"
                draggable
                title={`${label}: ${hint}. Click to add, or drag onto the canvas.`}
                aria-label={label}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-seqdraw', item);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => addItem(item)}
              >
                <Glyph />
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
