// Inspector option lists
import type { BlockKind, HeadStyle, LineStyle, NotePlacement } from '../../core/model';
import type { LineShape } from '../../flow/layout';
import type { LinkEnd, LinkStroke, Side } from '../../flow/model';
import type { Option } from '../components/Field';

// Sequence diagrams
export const LINE_STYLES: Option<LineStyle>[] = [
  { value: 'solid', label: 'Solid (call)' },
  { value: 'dotted', label: 'Dotted (reply)' },
];

export const HEAD_STYLES: Option<HeadStyle>[] = [
  { value: 'arrow', label: 'Arrow' },
  { value: 'open', label: 'Async (open)' },
  { value: 'cross', label: 'Cross' },
  { value: 'both', label: 'Both ends' },
  { value: 'none', label: 'None' },
];

export const ACTIVATIONS: Option<'' | '+' | '-'>[] = [
  { value: '', label: 'None' },
  { value: '+', label: 'Activate receiver (+)' },
  { value: '-', label: 'Deactivate sender (−)' },
];

export const NOTE_PLACEMENTS: Option<NotePlacement>[] = [
  { value: 'left of', label: 'Left of' },
  { value: 'right of', label: 'Right of' },
  { value: 'over', label: 'Over' },
];

export const BLOCK_KINDS: Option<BlockKind>[] = (['loop', 'alt', 'opt', 'par', 'critical', 'break', 'rect'] as const).map((k) => ({ value: k, label: k }));

// Flowcharts
export const LINK_STROKES: Option<LinkStroke>[] = [
  { value: 'normal', label: 'Solid' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'thick', label: 'Thick' },
  { value: 'invisible', label: 'Invisible' },
];

export const LINK_HEADS: Option<LinkEnd>[] = [
  { value: 'arrow', label: 'Arrow' },
  { value: 'circle', label: 'Circle' },
  { value: 'cross', label: 'Cross' },
  { value: 'none', label: 'None' },
];

export const LINK_WAYS: Option<'one' | 'both'>[] = [
  { value: 'one', label: 'One way' },
  { value: 'both', label: 'Both ways' },
];

export const LINK_LENGTHS: Option<number>[] = [1, 2, 3, 4].map((n) => ({ value: n, label: n === 1 ? 'Normal' : `${n} ranks` }));

export const SIDES: Option<Side | ''>[] = [
  { value: '', label: 'Auto' },
  { value: 'top', label: 'Top' },
  { value: 'right', label: 'Right' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
];

export const LINE_SHAPES: Option<LineShape>[] = [
  { value: 'auto', label: 'Auto (Mermaid)' },
  { value: 'ortho', label: 'Orthogonal' },
  { value: 'straight', label: 'Straight' },
  { value: 'curved', label: 'Curved' },
];
