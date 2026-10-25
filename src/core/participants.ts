// Participant shape registry
import type { ParticipantKind } from './model';

export interface ParticipantShapeDef {
  kind: ParticipantKind;
  // Display name
  name: string;
  hint: string;
  // New participant label
  defaultLabel: string;
  // Header height (px)
  height: number;
  // Icon with label below
  icon: boolean;
}

export const PARTICIPANT_SHAPES: readonly ParticipantShapeDef[] = [
  { kind: 'participant', name: 'Participant', hint: 'A system or service', defaultLabel: 'Service', height: 50, icon: false },
  { kind: 'actor', name: 'Actor', hint: 'A person', defaultLabel: 'User', height: 75, icon: true },
  { kind: 'database', name: 'Database', hint: 'A data store', defaultLabel: 'Database', height: 64, icon: false },
  { kind: 'boundary', name: 'Boundary', hint: 'A system boundary, such as a UI or API', defaultLabel: 'Boundary', height: 75, icon: true },
  { kind: 'control', name: 'Control', hint: 'A controller that coordinates logic', defaultLabel: 'Controller', height: 75, icon: true },
  { kind: 'entity', name: 'Entity', hint: 'A domain object', defaultLabel: 'Entity', height: 75, icon: true },
  { kind: 'collections', name: 'Collections', hint: 'A set of instances', defaultLabel: 'Collection', height: 56, icon: false },
  { kind: 'queue', name: 'Queue', hint: 'A message queue', defaultLabel: 'Queue', height: 50, icon: false },
];

const BY_KIND = Object.fromEntries(PARTICIPANT_SHAPES.map((d) => [d.kind, d])) as Record<ParticipantKind, ParticipantShapeDef>;

export const shapeOf = (kind: ParticipantKind): ParticipantShapeDef => BY_KIND[kind];

export const isParticipantKind = (k: string): k is ParticipantKind => k in BY_KIND;

// Mermaid declaration
export function declarationOf(kind: ParticipantKind): { keyword: 'participant' | 'actor'; meta: string } {
  if (kind === 'actor') return { keyword: 'actor', meta: '' };
  if (kind === 'participant') return { keyword: 'participant', meta: '' };
  return { keyword: 'participant', meta: `@{ "type": "${kind}" }` };
}
