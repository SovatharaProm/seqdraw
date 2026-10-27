// Canvas types
import type { FlowDrag } from './FlowOverlay';

export type View = { x: number; y: number; k: number };
export type Pt = { x: number; y: number };

export type SequenceDrag =
  | { type: 'pan'; start: Pt; view: View; moved: boolean; clear: boolean }
  | { type: 'participant'; id: string; start: Pt; origX: number; dx: number; moved: boolean }
  | { type: 'statement'; line: number; start: Pt; x: number; y: number; moved: boolean }
  | { type: 'resize'; id: string; start: Pt; w: number; h: number; dw: number; dh: number }
  | { type: 'connect'; from: string; start: Pt; to: Pt }
  | { type: 'reconnect'; line: number; end: 'from' | 'to'; start: Pt; to: Pt };

export type Drag = SequenceDrag | FlowDrag;

// Self-message loop width
export const SELF_W = 40;
