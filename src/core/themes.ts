// Diagram themes

export interface Theme {
  name: string;
  group: 'SeqDraw' | 'Classic' | 'Redux' | 'Neo';
  dark: boolean;
  fontFamily: string;
  // Label weight
  labelWeight: 'normal' | 'bold' | number;
  // Uppercase labels
  upperLabels?: boolean;
  // Grid color
  grid?: string;
  radius: number;
  strokeWidth: number;
  background: string;
  text: string;
  participantFill: string;
  participantStroke: string;
  // Per-participant colors
  palette?: { fill: string; stroke: string }[];
  lifeline: string;
  message: string;
  noteFill: string;
  noteStroke: string;
  frameStroke: string;
  frameLabelFill: string;
  activationFill: string;
  activationStroke: string;
  numberFill: string;
  numberText: string;
  // Lifeline dash (solid when unset, like Mermaid)
  lifelineDash?: string;
  // Message / lifeline width
  lineWidth?: number;
  // Frame border dash
  frameDash?: string;
  // Canvas grid
  gridStyle?: 'dots' | 'lines';
}

const CLASSIC_FONT = '"trebuchet ms", verdana, arial, sans-serif';
// System monospace
const MONO_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

const blueprint = {
  group: 'SeqDraw' as const,
  fontFamily: MONO_FONT,
  labelWeight: 600,
  upperLabels: true,
  radius: 2,
  strokeWidth: 1.5,
  lifelineDash: '6 4',
  gridStyle: 'lines' as const,
};
const MODERN_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Tailwind 50 / 400 (as in Mermaid's redux-color)
const LIGHT_PALETTE = [
  { fill: '#fdf4ff', stroke: '#e879f9' }, // fuchsia
  { fill: '#f0fdfa', stroke: '#2dd4bf' }, // teal
  { fill: '#fff7ed', stroke: '#fb923c' }, // orange
  { fill: '#ecfeff', stroke: '#22d3ee' }, // cyan
  { fill: '#f0fdf4', stroke: '#4ade80' }, // green
  { fill: '#f5f3ff', stroke: '#a78bfa' }, // violet
  { fill: '#fff1f2', stroke: '#fb7185' }, // rose
  { fill: '#f0f9ff', stroke: '#38bdf8' }, // sky
];

const DARK_PALETTE = [
  { fill: '#3b1a3f', stroke: '#e879f9' },
  { fill: '#11302c', stroke: '#2dd4bf' },
  { fill: '#3a2414', stroke: '#fb923c' },
  { fill: '#0f2f36', stroke: '#22d3ee' },
  { fill: '#132e1f', stroke: '#4ade80' },
  { fill: '#2c2342', stroke: '#a78bfa' },
  { fill: '#3a1a22', stroke: '#fb7185' },
  { fill: '#102a3a', stroke: '#38bdf8' },
];

const classic = { group: 'Classic' as const, fontFamily: CLASSIC_FONT, labelWeight: 'normal' as const, radius: 3, strokeWidth: 1.5 };

const reduxLight = {
  group: 'Redux' as const,
  dark: false,
  fontFamily: MODERN_FONT,
  labelWeight: 'normal' as const,
  radius: 3,
  strokeWidth: 1.5,
  lineWidth: 1,
  frameDash: '3 3',
  background: '#ffffff',
  text: '#1e1a34',
  participantFill: '#ffffff',
  participantStroke: '#1e1a34',
  lifeline: '#8d8b96',
  message: '#1e1a34',
  noteFill: '#fff8c5',
  noteStroke: '#d9b93c',
  frameStroke: '#6f6c7b',
  frameLabelFill: '#f4f4f4',
  activationFill: '#f4f4f4',
  activationStroke: '#1a1a1a',
  numberFill: '#1e1a34',
  numberText: '#ffffff',
};

const reduxDark = {
  ...reduxLight,
  dark: true,
  background: '#18181b',
  text: '#f4f4f5',
  participantFill: '#232327',
  participantStroke: '#e4e4e7',
  lifeline: '#8a8a93',
  message: '#e4e4e7',
  noteFill: '#2e2a17',
  noteStroke: '#b39a35',
  frameStroke: '#a1a1aa',
  frameLabelFill: '#2a2a2f',
  activationFill: '#2a2a2f',
  activationStroke: '#d4d4d8',
  numberFill: '#f4f4f5',
  numberText: '#18181b',
};

const neoLight = {
  group: 'Neo' as const,
  dark: false,
  fontFamily: MODERN_FONT,
  labelWeight: 500,
  radius: 12,
  strokeWidth: 1.25,
  background: '#ffffff',
  text: '#18181b',
  participantFill: '#f7f7fb',
  participantStroke: '#c9c9d6',
  lifeline: '#8e8ea3',
  message: '#3f3f46',
  noteFill: '#f4f0ff',
  noteStroke: '#c4b5fd',
  frameStroke: '#a1a1aa',
  frameLabelFill: '#f4f4f5',
  activationFill: '#ede9fe',
  activationStroke: '#8b5cf6',
  numberFill: '#7c3aed',
  numberText: '#ffffff',
};

export const THEMES: Record<string, Theme> = {
  blueprint: {
    ...blueprint,
    name: 'Blueprint',
    dark: true,
    grid: 'rgba(95, 212, 255, 0.16)',
    background: '#0f2a4a',
    text: '#e6f4ff',
    participantFill: '#12355c',
    participantStroke: '#e6f4ff',
    lifeline: '#5fd4ff',
    message: '#e6f4ff',
    noteFill: '#163e69',
    noteStroke: '#5fd4ff',
    frameStroke: '#5fd4ff',
    frameLabelFill: '#12355c',
    activationFill: '#1b4a7a',
    activationStroke: '#5fd4ff',
    numberFill: '#e6f4ff',
    numberText: '#0f2a4a',
  },
  'blueprint-light': {
    ...blueprint,
    name: 'Blueprint paper',
    dark: false,
    grid: 'rgba(10, 123, 191, 0.14)',
    background: '#f4f8fc',
    text: '#0f2a4a',
    participantFill: '#ffffff',
    participantStroke: '#0f2a4a',
    lifeline: '#0a7bbf',
    message: '#0f2a4a',
    noteFill: '#e6f1fb',
    noteStroke: '#0a7bbf',
    frameStroke: '#0a7bbf',
    frameLabelFill: '#e6f1fb',
    activationFill: '#dcebf8',
    activationStroke: '#0a7bbf',
    numberFill: '#0f2a4a',
    numberText: '#ffffff',
  },
  neutral: {
    ...classic,
    name: 'Neutral',
    dark: false,
    fontFamily: MODERN_FONT,
    background: '#ffffff',
    text: '#1d2b31',
    participantFill: '#f7fafb',
    participantStroke: '#3d5560',
    lifeline: '#a9bcc3',
    message: '#2c3e45',
    noteFill: '#f1f5f7',
    noteStroke: '#b8c9cf',
    frameStroke: '#7f98a1',
    frameLabelFill: '#e4ecef',
    activationFill: '#eaf1f3',
    activationStroke: '#5f7a84',
    numberFill: '#3a7383',
    numberText: '#ffffff',
  },
  default: {
    ...classic,
    name: 'Default (purple)',
    dark: false,
    background: '#ffffff',
    text: '#1f2937',
    participantFill: '#ECECFF',
    participantStroke: '#9370DB',
    lifeline: '#9ca3af',
    message: '#333333',
    noteFill: '#fff5ad',
    noteStroke: '#aaaa33',
    frameStroke: '#8b8bb0',
    frameLabelFill: '#ECECFF',
    activationFill: '#f4f4f4',
    activationStroke: '#666666',
    numberFill: '#333333',
    numberText: '#ffffff',
  },
  forest: {
    ...classic,
    name: 'Forest',
    dark: false,
    background: '#ffffff',
    text: '#14301a',
    participantFill: '#cde498',
    participantStroke: '#13540c',
    lifeline: '#6b8f5e',
    message: '#14301a',
    noteFill: '#fff5ad',
    noteStroke: '#6eaa49',
    frameStroke: '#13540c',
    frameLabelFill: '#cde498',
    activationFill: '#e8f3d6',
    activationStroke: '#13540c',
    numberFill: '#13540c',
    numberText: '#ffffff',
  },
  base: {
    ...classic,
    name: 'Base',
    dark: false,
    background: '#ffffff',
    text: '#333333',
    participantFill: '#fff4dd',
    participantStroke: '#c99a3a',
    lifeline: '#b9a888',
    message: '#333333',
    noteFill: '#fff5ad',
    noteStroke: '#c9b13a',
    frameStroke: '#c99a3a',
    frameLabelFill: '#fff4dd',
    activationFill: '#fffaf0',
    activationStroke: '#c99a3a',
    numberFill: '#333333',
    numberText: '#ffffff',
  },
  dark: {
    ...classic,
    name: 'Dark',
    dark: true,
    background: '#1e1e1e',
    text: '#e5e5e5',
    participantFill: '#1f2020',
    participantStroke: '#cccccc',
    lifeline: '#777777',
    message: '#d4d4d4',
    noteFill: '#3b3a2a',
    noteStroke: '#9a9a5a',
    frameStroke: '#9a9a9a',
    frameLabelFill: '#2b2b2b',
    activationFill: '#2b2b2b',
    activationStroke: '#bbbbbb',
    numberFill: '#e5e5e5',
    numberText: '#1e1e1e',
  },
  redux: { ...reduxLight, name: 'Redux' },
  'redux-dark': { ...reduxDark, name: 'Redux dark' },
  'redux-color': { ...reduxLight, name: 'Redux color', palette: LIGHT_PALETTE, noteFill: '#fff8db', noteStroke: '#e0b93b' },
  'redux-dark-color': { ...reduxDark, name: 'Redux dark color', palette: DARK_PALETTE, noteFill: '#3a3420', noteStroke: '#d6b544' },
  neo: { ...neoLight, name: 'Neo' },
  'neo-dark': {
    ...neoLight,
    name: 'Neo dark',
    dark: true,
    background: '#121214',
    text: '#f4f4f5',
    participantFill: '#1e1e22',
    participantStroke: '#3f3f46',
    lifeline: '#3f3f46',
    message: '#d4d4d8',
    noteFill: '#251f38',
    noteStroke: '#6d5bb5',
    frameStroke: '#71717a',
    frameLabelFill: '#1e1e22',
    activationFill: '#2a2440',
    activationStroke: '#a78bfa',
    numberFill: '#a78bfa',
    numberText: '#121214',
  },
};

// Default theme
export const DEFAULT_THEME = 'redux';

export const resolveTheme = (id: unknown): string => (typeof id === 'string' && THEMES[id] ? id : DEFAULT_THEME);

// Participant colors
export function participantColors(t: Theme, index: number): { fill: string; stroke: string } {
  return t.palette ? t.palette[index % t.palette.length] : { fill: t.participantFill, stroke: t.participantStroke };
}

// Legacy theme ids
export const LEGACY_THEMES: Record<string, string> = { mermaid: 'default', dark: 'dark', forest: 'forest' };
