// Flowchart model
import type { DiagramConfig, ParseError } from '../core/model';

export type FlowDir = 'TB' | 'TD' | 'BT' | 'LR' | 'RL';

export type FlowShape =
  | 'rect'
  | 'round'
  | 'stadium'
  | 'subroutine'
  | 'cylinder'
  | 'circle'
  | 'double-circle'
  | 'asymmetric'
  | 'diamond'
  | 'hexagon'
  | 'parallelogram'
  | 'parallelogram-alt'
  | 'trapezoid'
  | 'trapezoid-alt'
  // Borderless; blank label = free link end
  | 'text';

export interface NodeRef {
  id: string;
  shape?: FlowShape;
  text?: string;
  // `@{ ... }` source
  meta?: string;
  classes?: string[];
}

// Node border side
export type Side = 'top' | 'right' | 'bottom' | 'left';

export type LinkStroke = 'normal' | 'dotted' | 'thick' | 'invisible';
export type LinkEnd = 'none' | 'arrow' | 'circle' | 'cross';

export interface Link {
  stroke: LinkStroke;
  start: LinkEnd;
  end: LinkEnd;
  length: number;
  text?: string;
  // `A -- text --> B` form
  inline?: boolean;
}

export type FlowStatement =
  | { type: 'header'; keyword: 'flowchart' | 'graph'; dir: FlowDir }
  | { type: 'frontmatter'; text: string }
  | { type: 'chain'; groups: NodeRef[][]; links: Link[] }
  | { type: 'subgraph'; id: string; title?: string }
  | { type: 'end' }
  | { type: 'direction'; dir: FlowDir }
  | { type: 'classDef'; names: string[]; style: string }
  | { type: 'class'; ids: string[]; name: string }
  | { type: 'style'; id: string; style: string }
  | { type: 'linkStyle'; indices: number[] | 'default'; style: string }
  // click, accTitle, ...
  | { type: 'other'; text: string }
  | { type: 'multi'; parts: FlowStatement[] }
  | { type: 'comment'; text: string }
  | { type: 'blank' }
  | { type: 'unknown'; text: string };

export interface FlowLine {
  raw: string | null;
  indent: string;
  stmt: FlowStatement;
}

export interface FlowNode {
  id: string;
  label: string;
  shape: FlowShape;
  // Line holding the label
  declLine?: number;
  // First mention
  firstLine: number;
  classes: string[];
  style?: string;
  parent?: string;
}

export interface FlowEdge {
  // linkStyle index
  index: number;
  line: number;
  // Part of a `;` line
  part: number;
  // Link within the chain
  link: number;
  from: string;
  to: string;
  spec: Link;
  style?: string;
}

export interface FlowSubgraph {
  id: string;
  title: string;
  line: number;
  endLine: number;
  parent?: string;
  dir?: FlowDir;
}

export interface FlowDoc {
  lines: FlowLine[];
  dir: FlowDir;
  nodes: FlowNode[];
  edges: FlowEdge[];
  subgraphs: FlowSubgraph[];
  classDefs: Record<string, string>;
  title?: string;
  config: DiagramConfig;
  errors: ParseError[];
}
