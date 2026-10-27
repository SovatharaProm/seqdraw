import { isBlankDiagram } from '../core/diagram';
import { FLOW_SHAPES } from '../flow/shapes';
import { PARTICIPANT_SHAPES } from '../core/participants';
import { addItem, type PaletteItem } from '../state/actions';
import { useStore } from '../state/store';
import { Icons, ShapeIcon } from './icons';

type Group = { title: string; items: { item: PaletteItem; label: string; hint: string }[] };

const GROUPS: Group[] = [
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

const FLOW_GROUPS: Group[] = [
  {
    title: 'Shapes',
    items: FLOW_SHAPES.filter((s) => s.palette).map((s) => ({ item: `flow:${s.shape}` as const, label: s.name, hint: `${s.hint}. Drop on a node to add a connected step` })),
  },
  {
    title: 'Structure',
    items: [{ item: 'subgraph', label: 'Subgraph', hint: 'A titled group of nodes' }],
  },
];

// Blank: both kinds, the first shape decides
const START_GROUPS: Group[] = [
  { title: 'Sequence diagram', items: GROUPS[0].items.map((i) => ({ ...i, label: `${i.label} (sequence diagram)` })) },
  { title: 'Flowchart', items: FLOW_GROUPS[0].items.map((i) => ({ ...i, label: `${i.label} (flowchart)` })) },
];

const glyph = (item: PaletteItem) => {
  if (item.startsWith('flow:')) return <ShapeIcon shape={item.slice(5) as never} />;
  const G = Icons[item as keyof typeof Icons];
  return <G />;
};

// Shape strip
export function Palette() {
  const flow = useStore((s) => s.kind === 'flowchart');
  const blank = useStore((s) => isBlankDiagram(s.pending ?? s.code));
  return (
    <aside className="palette" aria-label="Shapes">
      {(blank ? START_GROUPS : flow ? FLOW_GROUPS : GROUPS).map((g) => (
        <div key={g.title} className="palette-group" role="group" aria-label={g.title}>
          {g.items.map(({ item, label, hint }) => (
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
              {glyph(item)}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
