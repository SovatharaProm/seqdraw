// Document model

// Participant shapes
export type ParticipantKind = 'participant' | 'actor' | 'database' | 'boundary' | 'control' | 'entity' | 'collections' | 'queue';

export type LineStyle = 'solid' | 'dotted';
export type HeadStyle = 'none' | 'arrow' | 'cross' | 'open' | 'both';

export interface ArrowSpec {
  line: LineStyle;
  head: HeadStyle;
}

// Arrow tokens (longest first)
export const ARROW_TOKENS = ['<<-->>', '<<->>', '-->>', '->>', '-->', '->', '--x', '-x', '--)', '-)'] as const;
export type ArrowToken = (typeof ARROW_TOKENS)[number];

export const ARROW_SPECS: Record<ArrowToken, ArrowSpec> = {
  '->': { line: 'solid', head: 'none' },
  '-->': { line: 'dotted', head: 'none' },
  '->>': { line: 'solid', head: 'arrow' },
  '-->>': { line: 'dotted', head: 'arrow' },
  '-x': { line: 'solid', head: 'cross' },
  '--x': { line: 'dotted', head: 'cross' },
  '-)': { line: 'solid', head: 'open' },
  '--)': { line: 'dotted', head: 'open' },
  '<<->>': { line: 'solid', head: 'both' },
  '<<-->>': { line: 'dotted', head: 'both' },
};

export function arrowToken(spec: ArrowSpec): ArrowToken {
  const hit = (Object.keys(ARROW_SPECS) as ArrowToken[]).find(
    (t) => ARROW_SPECS[t].line === spec.line && ARROW_SPECS[t].head === spec.head,
  );
  return hit ?? '->>';
}

export type BlockKind = 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'rect';
export type BranchKind = 'else' | 'and' | 'option';
export type NotePlacement = 'left of' | 'right of' | 'over';

export type Statement =
  | { type: 'header' }
  // Frontmatter line
  | { type: 'frontmatter'; text: string }
  | { type: 'title'; text: string }
  | { type: 'autonumber'; off?: boolean; start?: number; step?: number }
  | { type: 'participant'; kind: ParticipantKind; id: string; alias?: string }
  | { type: 'message'; from: string; to: string; arrow: ArrowToken; text: string; activation?: '+' | '-' }
  | { type: 'note'; placement: NotePlacement; actors: string[]; text: string }
  | { type: 'block'; kind: BlockKind; label: string }
  | { type: 'branch'; kind: BranchKind; label: string }
  | { type: 'end' }
  | { type: 'activate' | 'deactivate'; actor: string }
  | { type: 'comment'; text: string }
  | { type: 'blank' }
  | { type: 'unknown'; text: string };

export interface Line {
  // Original text (null = reformat)
  raw: string | null;
  indent: string;
  stmt: Statement;
}

export interface Participant {
  id: string;
  label: string;
  kind: ParticipantKind;
  // Declaration line
  declLine?: number;
}

export interface ParseError {
  line: number; // 0-based
  message: string;
}

// Diagram config
export interface DiagramConfig {
  theme?: string;
  // Theme line
  themeLine?: number;
  // `layout: elk`
  layout?: string;
  layoutLine?: number;
  // Frontmatter range
  frontmatter?: [number, number];
}

export interface Doc {
  lines: Line[];
  participants: Participant[];
  title?: string;
  config: DiagramConfig;
  errors: ParseError[];
}

type NodeSide = 'top' | 'right' | 'bottom' | 'left';

// Layout overrides (saved in .seqd, not in code)
export interface LayoutOverrides {
  // Sequence diagram offset on the board
  origin?: { x: number; y: number };
  // x: center, y: top (free drag), stretch: extra lifeline length
  participants: Record<string, { width?: number; height?: number; gap?: number; x?: number; y?: number; stretch?: number }>;
  // Flowchart node positions (centers)
  nodes?: Record<string, { x: number; y: number }>;
  // Flowchart links by edge key
  ports?: Record<string, { from?: NodeSide; to?: NodeSide; fromAt?: number; toAt?: number; route?: { x: number; y: number }[]; shape?: 'ortho' | 'straight' | 'curved'; points?: { x: number; y: number }[] }>;
}

export const emptyOverrides = (): LayoutOverrides => ({ participants: {}, nodes: {}, ports: {} });
