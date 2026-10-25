// Inspector
import { useEffect, useState } from 'react';
import { fromMermaidText, toMermaidText } from '../core/measure';
import { PARTICIPANT_SHAPES } from '../core/participants';
import { ARROW_SPECS, arrowToken, type ArrowToken, type BlockKind, type HeadStyle, type LineStyle, type NotePlacement, type ParticipantKind, type Statement } from '../core/model';
import * as actions from '../state/actions';
import { useStore } from '../state/store';
import { Icons } from './icons';

// Text field
function TextField({ value, onCommit, multiline, label }: { value: string; onCommit: (v: string) => void; multiline?: boolean; label: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => v !== value && onCommit(v);
  const props = {
    value: v,
    'aria-label': label,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
        e.preventDefault();
        commit();
      }
      if (e.key === 'Escape') setV(value);
    },
  };
  return multiline ? <textarea rows={2} {...props} /> : <input {...props} />;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const doc = useStore((s) => s.doc);
  const overrides = useStore((s) => s.overrides);
  if (!selection) return null;

  const pOptions = doc.participants.map((p) => (
    <option key={p.id} value={p.id}>{p.label}</option>
  ));

  let body: React.ReactNode = null;
  let title = '';

  if (selection.kind === 'participant') {
    const p = doc.participants.find((x) => x.id === selection.id);
    if (!p) return null;
    const ov = overrides.participants[p.id];
    title = 'Participant';
    body = (
      <>
        <Row label="Label">
          <TextField label="Label" value={p.label} onCommit={(v) => actions.setText({ kind: 'participant', id: p.id }, v)} />
        </Row>
        <Row label="Shape">
          <select value={p.kind} onChange={(e) => actions.changeParticipantKind(p.id, e.target.value as ParticipantKind)}>
            {PARTICIPANT_SHAPES.map((s) => (
              <option key={s.kind} value={s.kind}>{s.name}</option>
            ))}
          </select>
        </Row>
        {(ov?.width || ov?.height || ov?.gap !== undefined) && (
          <button className="link" onClick={() => actions.resetParticipantSize(p.id)}>Reset size</button>
        )}
      </>
    );
  } else {
    const s = doc.lines[selection.line]?.stmt;
    if (!s) return null;
    if (s.type === 'message') {
      const spec = ARROW_SPECS[s.arrow];
      const setArrow = (patch: Partial<{ line: LineStyle; head: HeadStyle }>) => actions.updateStatement(selection.line, { arrow: arrowToken({ ...spec, ...patch }) as ArrowToken });
      title = 'Message';
      body = (
        <>
          <Row label="Text">
            <TextField multiline label="Text" value={fromMermaidText(s.text)} onCommit={(v) => actions.updateStatement(selection.line, { text: toMermaidText(v) })} />
          </Row>
          <div className="field-pair">
            <Row label="From">
              <select value={s.from} onChange={(e) => actions.updateStatement(selection.line, { from: e.target.value })}>{pOptions}</select>
            </Row>
            <Row label="To">
              <select value={s.to} onChange={(e) => actions.updateStatement(selection.line, { to: e.target.value })}>{pOptions}</select>
            </Row>
          </div>
          <div className="field-pair">
            <Row label="Line">
              <select value={spec.line} onChange={(e) => setArrow({ line: e.target.value as LineStyle })}>
                <option value="solid">Solid (call)</option>
                <option value="dotted">Dotted (reply)</option>
              </select>
            </Row>
            <Row label="Head">
              <select value={spec.head} onChange={(e) => setArrow({ head: e.target.value as HeadStyle })}>
                <option value="arrow">Arrow ▶</option>
                <option value="open">Async ⟩</option>
                <option value="cross">Cross ✕</option>
                <option value="both">Both ◀▶</option>
                <option value="none">None</option>
              </select>
            </Row>
          </div>
          <Row label="Activation">
            <select value={s.activation ?? ''} onChange={(e) => actions.updateStatement(selection.line, { activation: (e.target.value || undefined) as '+' | '-' | undefined })}>
              <option value="">None</option>
              <option value="+">Activate receiver (+)</option>
              <option value="-">Deactivate sender (−)</option>
            </select>
          </Row>
          <button className="link" onClick={() => actions.updateStatement(selection.line, { from: s.to, to: s.from })}><Icons.swap /> Reverse direction</button>
        </>
      );
    } else if (s.type === 'note') {
      title = 'Note';
      const setNote = (patch: Partial<Statement & { type: 'note' }>) => actions.updateStatement(selection.line, patch);
      body = (
        <>
          <Row label="Text">
            <TextField multiline label="Text" value={fromMermaidText(s.text)} onCommit={(v) => setNote({ text: toMermaidText(v) })} />
          </Row>
          <div className="field-pair">
            <Row label="Position">
              <select
                value={s.placement}
                onChange={(e) => {
                  const placement = e.target.value as NotePlacement;
                  setNote({ placement, actors: placement === 'over' ? s.actors : s.actors.slice(0, 1) });
                }}
              >
                <option value="left of">Left of</option>
                <option value="right of">Right of</option>
                <option value="over">Over</option>
              </select>
            </Row>
            <Row label="Participant">
              <select value={s.actors[0]} onChange={(e) => setNote({ actors: [e.target.value, ...s.actors.slice(1)] })}>{pOptions}</select>
            </Row>
          </div>
          {s.placement === 'over' && (
            <Row label="Span to">
              <select value={s.actors[1] ?? ''} onChange={(e) => setNote({ actors: e.target.value ? [s.actors[0], e.target.value] : [s.actors[0]] })}>
                <option value="">— single —</option>
                {pOptions}
              </select>
            </Row>
          )}
        </>
      );
    } else if (s.type === 'block') {
      title = 'Block';
      body = (
        <>
          <Row label="Type">
            <select value={s.kind} onChange={(e) => actions.updateStatement(selection.line, { kind: e.target.value as BlockKind })}>
              {['loop', 'alt', 'opt', 'par', 'critical', 'break', 'rect'].map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </Row>
          <Row label={s.kind === 'rect' ? 'Color' : 'Label'}>
            <TextField label="Label" value={s.label} onCommit={(v) => actions.updateStatement(selection.line, { label: v.trim() })} />
          </Row>
          <p className="hint">Drag the block's label to move it with its contents. Drag messages in or out to change what it holds.</p>
          <button className="link" onClick={() => actions.deleteSelection(selection)}>Remove block, keep contents</button>
          <button className="link danger" onClick={() => actions.deleteBlockWithContents(selection.line)}>Delete block and contents</button>
        </>
      );
    }
  }

  return (
    <aside className="inspector" aria-label="Properties">
      <div className="inspector-head">
        <strong>{title}</strong>
        <button className="icon" title="Delete (Del)" aria-label="Delete" onClick={() => actions.deleteSelection(selection)}><Icons.trash /></button>
      </div>
      {body}
    </aside>
  );
}
