// Sequence diagram inspector
import { fromMermaidText, toMermaidText } from '../../core/measure';
import { ARROW_SPECS, arrowToken, type ArrowToken, type HeadStyle, type LineStyle, type Statement } from '../../core/model';
import { PARTICIPANT_SHAPES } from '../../core/participants';
import * as actions from '../../state/actions';
import { useStore, type Selection } from '../../state/store';
import { LinkButton } from '../components/Button';
import { Field, FieldPair, SelectField, TextField, type Option } from '../components/Field';
import { Icons } from '../icons';
import { ACTIVATIONS, BLOCK_KINDS, HEAD_STYLES, LINE_STYLES, NOTE_PLACEMENTS } from './options';
import { InspectorPanel } from './Panel';

type Stmt<T extends Statement['type']> = Statement & { type: T };
type LineSel = Selection & { line: number };

const SHAPES = PARTICIPANT_SHAPES.map((s) => ({ value: s.kind, label: s.name }));

function useParticipantOptions(): Option<string>[] {
  const participants = useStore((s) => s.doc.participants);
  return participants.map((p) => ({ value: p.id, label: p.label }));
}

function ParticipantPanel({ selection, id }: { selection: Selection; id: string }) {
  const p = useStore((s) => s.doc.participants.find((x) => x.id === id));
  const ov = useStore((s) => s.overrides.participants[id]);
  if (!p) return null;
  return (
    <InspectorPanel title="Participant" selection={selection}>
      <Field label="Label">
        <TextField label="Label" value={p.label} onCommit={(v) => actions.setText({ kind: 'participant', id }, v)} />
      </Field>
      <SelectField label="Shape" value={p.kind} options={SHAPES} onChange={(k) => actions.changeParticipantKind(id, k)} />
      {(ov?.width || ov?.height || ov?.gap !== undefined) && <LinkButton onClick={() => actions.resetParticipantSize(id)}>Reset size</LinkButton>}
    </InspectorPanel>
  );
}

function MessagePanel({ selection, s }: { selection: LineSel; s: Stmt<'message'> }) {
  const people = useParticipantOptions();
  const update = (patch: Partial<Stmt<'message'>>) => actions.updateStatement(selection.line, patch);
  const spec = ARROW_SPECS[s.arrow];
  const setArrow = (patch: Partial<{ line: LineStyle; head: HeadStyle }>) => update({ arrow: arrowToken({ ...spec, ...patch }) as ArrowToken });
  return (
    <InspectorPanel title="Message" selection={selection}>
      <Field label="Text">
        <TextField multiline label="Text" value={fromMermaidText(s.text)} onCommit={(v) => update({ text: toMermaidText(v) })} />
      </Field>
      <FieldPair>
        <SelectField label="From" value={s.from} options={people} onChange={(from) => update({ from })} />
        <SelectField label="To" value={s.to} options={people} onChange={(to) => update({ to })} />
      </FieldPair>
      <FieldPair>
        <SelectField label="Line" value={spec.line} options={LINE_STYLES} onChange={(line) => setArrow({ line })} />
        <SelectField label="Head" value={spec.head} options={HEAD_STYLES} onChange={(head) => setArrow({ head })} />
      </FieldPair>
      <SelectField label="Activation" value={s.activation ?? ''} options={ACTIVATIONS} onChange={(a) => update({ activation: a || undefined })} />
      <LinkButton onClick={() => update({ from: s.to, to: s.from })}><Icons.swap /> Reverse direction</LinkButton>
    </InspectorPanel>
  );
}

function NotePanel({ selection, s }: { selection: LineSel; s: Stmt<'note'> }) {
  const people = useParticipantOptions();
  const update = (patch: Partial<Stmt<'note'>>) => actions.updateStatement(selection.line, patch);
  return (
    <InspectorPanel title="Note" selection={selection}>
      <Field label="Text">
        <TextField multiline label="Text" value={fromMermaidText(s.text)} onCommit={(v) => update({ text: toMermaidText(v) })} />
      </Field>
      <FieldPair>
        <SelectField label="Position" value={s.placement} options={NOTE_PLACEMENTS} onChange={(placement) => update({ placement, actors: placement === 'over' ? s.actors : s.actors.slice(0, 1) })} />
        <SelectField label="Participant" value={s.actors[0]} options={people} onChange={(a) => update({ actors: [a, ...s.actors.slice(1)] })} />
      </FieldPair>
      {s.placement === 'over' && (
        <SelectField label="Span to" value={s.actors[1] ?? ''} options={[{ value: '', label: '— single —' }, ...people]} onChange={(a) => update({ actors: a ? [s.actors[0], a] : [s.actors[0]] })} />
      )}
    </InspectorPanel>
  );
}

function BlockPanel({ selection, s }: { selection: LineSel; s: Stmt<'block'> }) {
  const update = (patch: Partial<Stmt<'block'>>) => actions.updateStatement(selection.line, patch);
  return (
    <InspectorPanel title="Block" selection={selection}>
      <SelectField label="Type" value={s.kind} options={BLOCK_KINDS} onChange={(kind) => update({ kind })} />
      <Field label={s.kind === 'rect' ? 'Color' : 'Label'}>
        <TextField label="Label" value={s.label} onCommit={(v) => update({ label: v.trim() })} />
      </Field>
      <p className="hint">Drag the block's label to move it with its contents. Drag messages in or out to change what it holds.</p>
      <LinkButton onClick={() => actions.deleteSelection(selection)}>Remove block, keep contents</LinkButton>
      <LinkButton danger onClick={() => actions.deleteBlockWithContents(selection.line)}>Delete block and contents</LinkButton>
    </InspectorPanel>
  );
}

export function SequenceInspector({ selection }: { selection: Selection }) {
  const stmt = useStore((s) => ('line' in selection ? s.doc.lines[selection.line]?.stmt : undefined));
  if (selection.kind === 'participant') return <ParticipantPanel selection={selection} id={selection.id} />;
  if (!('line' in selection) || !stmt) return null;
  switch (stmt.type) {
    case 'message':
      return <MessagePanel selection={selection} s={stmt} />;
    case 'note':
      return <NotePanel selection={selection} s={stmt} />;
    case 'block':
      return <BlockPanel selection={selection} s={stmt} />;
    default:
      return null;
  }
}
