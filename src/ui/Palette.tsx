import { Fragment, useEffect, useRef, useState } from 'react';
import { isBlankDiagram } from '../core/diagram';
import { FLOW_CATEGORIES, FLOW_SHAPES } from '../flow/shapes';
import { PARTICIPANT_GROUPS, PARTICIPANT_SHAPES } from '../core/participants';
import { addItem, type PaletteItem } from '../state/actions';
import { useStore } from '../state/store';
import { Icons, ShapeIcon } from './icons';

type Item = { item: PaletteItem; label: string; hint: string; section?: string };
type Group = { title: string; items: Item[] };

// Built from the shape registries' palette groups
const participantItems = (group: string, section?: string): Item[] =>
  PARTICIPANT_SHAPES.filter((s) => s.group === group).map((s) => ({ item: s.kind, label: s.name, hint: s.hint, section }));
const flowItems = (category: string, section?: string): Item[] =>
  FLOW_SHAPES.filter((s) => s.palette === category).map((s) => ({ item: `flow:${s.shape}` as const, label: s.name, hint: `${s.hint}. Drop on a node to add a connected step`, section }));

const GROUPS: Group[] = [
  ...PARTICIPANT_GROUPS.map((g) => ({ title: g.name, items: participantItems(g.id) })),
  {
    title: 'Messages',
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
  ...FLOW_CATEGORIES.map((c) => ({ title: c.name, items: flowItems(c.id) })),
  { title: 'Structure', items: [{ item: 'subgraph', label: 'Subgraph', hint: 'A titled group of nodes' }] },
];

// Blank: both kinds, the first shape decides
const START_GROUPS: Group[] = [
  { title: 'Sequence diagram', items: PARTICIPANT_GROUPS.flatMap((g) => participantItems(g.id, g.name)) },
  { title: 'Flowchart', items: FLOW_CATEGORIES.flatMap((c) => flowItems(c.id, c.name)) },
];

const glyph = (item: PaletteItem) => {
  if (item.startsWith('flow:')) return <ShapeIcon shape={item.slice(5) as never} />;
  const G = Icons[item as keyof typeof Icons];
  return <G />;
};

const DRAG_TYPE = 'application/x-seqdraw';

function PaletteItemButton({ item, label, hint, wide, onPick, onDragging }: { item: PaletteItem; label: string; hint: string; wide?: boolean; onPick?: () => void; onDragging?: (on: boolean) => void }) {
  return (
    <button
      className={`palette-item${wide ? ' wide' : ''}`}
      draggable
      title={`${label}: ${hint}. Click to add, or drag onto the canvas.`}
      aria-label={label}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, item);
        e.dataTransfer.effectAllowed = 'copy';
        onDragging?.(true);
      }}
      onDragEnd={() => onDragging?.(false)}
      onClick={() => (addItem(item), onPick?.())}
    >
      {glyph(item)}
      {wide && (
        <span className="palette-item-text">
          <b>{label}</b>
        </span>
      )}
    </button>
  );
}

// Shape dock: one button per group, items in a flyout
export function Palette() {
  const flow = useStore((s) => s.kind === 'flowchart');
  const blank = useStore((s) => isBlankDiagram(s.pending ?? s.code));
  const groups = blank ? START_GROUPS : flow ? FLOW_GROUPS : GROUPS;
  const [open, setOpen] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [left, setLeft] = useState(0);
  const ref = useRef<HTMLElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }, [open]);
  useEffect(() => setOpen(null), [blank, flow]);

  const group = groups.find((g) => g.title === open);
  return (
    <aside className="palette" aria-label="Shapes" ref={ref}>
      {groups.map((g) =>
        g.items.length === 1 ? (
          <PaletteItemButton key={g.title} {...g.items[0]} />
        ) : (
          <button
            key={g.title}
            className={`palette-group-btn${open === g.title ? ' active' : ''}`}
            aria-expanded={open === g.title}
            onClick={(e) => {
              setLeft((e.currentTarget as HTMLElement).offsetLeft);
              setOpen(open === g.title ? null : g.title);
            }}
          >
            {glyph(g.items[0].item)}
            <span>{g.title}</span>
            <span className={`caret${open === g.title ? ' open' : ''}`}><Icons.chevronDown /></span>
          </button>
        ),
      )}
      {group && (
        // Hide, don't unmount, while dragging
        <div className={`palette-flyout${dragging ? ' dragging' : ''}`} style={{ left }} role="group" aria-label={group.title}>
          {!group.items[0].section && <div className="menu-section">{group.title}</div>}
          {group.items.map((i, n) => (
            <Fragment key={i.item}>
              {i.section && i.section !== group.items[n - 1]?.section && <div className="menu-section">{i.section}</div>}
              <PaletteItemButton {...i} wide onPick={() => setOpen(null)} onDragging={(on) => (setDragging(on), !on && setOpen(null))} />
            </Fragment>
          ))}
        </div>
      )}
    </aside>
  );
}
