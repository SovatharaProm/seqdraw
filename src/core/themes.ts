// Diagram themes: Redux color, one per app appearance

export interface Theme {
  name: string;
  dark: boolean;
  fontFamily: string;
  // Label weight
  labelWeight: 'normal' | 'bold' | number;
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
  // Message / lifeline width
  lineWidth?: number;
  // Frame border dash
  frameDash?: string;
}

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

const reduxLight = {
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

export type ThemeId = 'redux-color' | 'redux-dark-color';

export const THEMES: Record<ThemeId, Theme> = {
  'redux-color': { ...reduxLight, name: 'Redux color', palette: LIGHT_PALETTE, noteFill: '#fff8db', noteStroke: '#e0b93b' },
  'redux-dark-color': { ...reduxDark, name: 'Redux dark color', palette: DARK_PALETTE, noteFill: '#3a3420', noteStroke: '#d6b544' },
};

// Theme for the app appearance
export const themeIdFor = (dark: boolean): ThemeId => (dark ? 'redux-dark-color' : 'redux-color');
export const themeFor = (dark: boolean): Theme => THEMES[themeIdFor(dark)];

// Participant colors
export function participantColors(t: Theme, index: number): { fill: string; stroke: string } {
  return t.palette ? t.palette[index % t.palette.length] : { fill: t.participantFill, stroke: t.participantStroke };
}
