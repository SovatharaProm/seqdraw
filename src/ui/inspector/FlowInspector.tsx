// Flowchart inspector
import { fromMermaidText } from '../../core/measure';
import type { FlowEdge, FlowShape } from '../../flow/model';
import { FLOW_SHAPES, isFreeEnd } from '../../flow/shapes';
import * as actions from '../../state/actions';
import * as flowActions from '../../state/flowActions';
import { useStore, type Selection } from '../../state/store';
import { LinkButton } from '../components/Button';
import { Field, FieldPair, SelectField, TextField, type Option } from '../components/Field';
import { Icons } from '../icons';
import { LINE_SHAPES, LINK_HEADS, LINK_LENGTHS, LINK_STROKES, LINK_WAYS, SIDES } from './options';
import { FitTextSwitch } from './FitTextSwitch';
import { InspectorPanel } from './Panel';

const SHAPES: Option<FlowShape>[] = FLOW_SHAPES.map((s) => ({ value: s.shape, label: s.name }));

function useNodeOptions(): Option<string>[] {
  const nodes = useStore((s) => s.flow?.nodes ?? []);
  return nodes.map((n) => ({ value: n.id, label: isFreeEnd(n) ? `${n.id} · free end` : n.label === n.id ? n.id : `${n.id} · ${n.label}` }));
}

function NodePanel({ selection, id }: { selection: Selection; id: string }) {
  const n = useStore((s) => s.flow?.nodes.find((x) => x.id === id));
  const placed = useStore((s) => flowActions.hasPositions(s.overrides));
  if (!n) return null;
  return (
    <InspectorPanel title="Node" selection={selection}>
      <SelectField label="Shape" value={n.shape} options={SHAPES} onChange={(shape) => flowActions.setShape(id, shape)} />
      <FitTextSwitch onFit={() => flowActions.resetNodeSize(id)} />
      {placed && <LinkButton onClick={flowActions.autoLayout}>Auto layout (re-arrange all)</LinkButton>}
    </InspectorPanel>
  );
}

function EdgePanel({ selection, e }: { selection: Selection; e: FlowEdge }) {
  const nodes = useNodeOptions();
  const routed = useStore((s) => s.flowLayout?.edges.find((x) => x.index === e.index));
  const spec = e.spec;
  const both = spec.start !== 'none';
  const set = (patch: Parameters<typeof flowActions.updateEdge>[1]) => flowActions.updateEdge(e.index, patch);
  const side = (end: 'from' | 'to') => (end === 'from' ? routed?.fromSide : routed?.toSide) ?? '';
  const setSide = (end: 'from' | 'to', v: (typeof SIDES)[number]['value']) => flowActions.setEdgeSides(e.index, { [end]: v || undefined });
  return (
    <InspectorPanel title="Link" selection={selection}>
      <Field label="Label">
        <TextField multiline label="Label" value={fromMermaidText(spec.text ?? '')} onCommit={(v) => actions.setText(selection, v)} />
      </Field>
      <FieldPair>
        <SelectField label="From" value={e.from} options={nodes} onChange={(from) => set({ from })} />
        <SelectField label="To" value={e.to} options={nodes} onChange={(to) => set({ to })} />
      </FieldPair>
      <FieldPair>
        <SelectField label="Line" value={spec.stroke} options={LINK_STROKES} onChange={(stroke) => set({ stroke })} />
        <SelectField label="Head" value={spec.end} options={LINK_HEADS} onChange={(end) => set({ end, start: both && end !== 'none' ? end : 'none' })} />
      </FieldPair>
      <FieldPair>
        <SelectField label="Ends" value={both ? 'both' : 'one'} options={LINK_WAYS} disabled={spec.end === 'none'} onChange={(w) => set({ start: w === 'both' ? spec.end : 'none' })} />
        <SelectField label="Length" value={spec.length} options={LINK_LENGTHS} onChange={(length) => set({ length })} />
      </FieldPair>
      <SelectField label="Line style" value={routed?.shape ?? 'auto'} options={LINE_SHAPES} onChange={(v) => flowActions.setEdgeShape(e.index, v)} />
      <FieldPair>
        <SelectField label="Start side" value={side('from')} options={SIDES} onChange={(v) => setSide('from', v)} />
        <SelectField label="End side" value={side('to')} options={SIDES} onChange={(v) => setSide('to', v)} />
      </FieldPair>
      <LinkButton onClick={() => flowActions.reverseEdge(e.index)}><Icons.swap /> Reverse direction</LinkButton>
      {!!(routed?.route?.length || routed?.bends?.length) && <LinkButton onClick={() => flowActions.resetEdgeRoute(e.index)}>Reset route</LinkButton>}
      {(routed?.fromSide || routed?.toSide) && <LinkButton onClick={() => flowActions.setEdgeSides(e.index, { from: undefined, to: undefined })}>Unpin sides</LinkButton>}
    </InspectorPanel>
  );
}

function SubgraphPanel({ selection, id }: { selection: Selection; id: string }) {
  const sg = useStore((s) => s.flow?.subgraphs.find((x) => x.id === id));
  if (!sg) return null;
  return (
    <InspectorPanel title="Subgraph" selection={selection}>
      <Field label="Title">
        <TextField label="Title" value={sg.title} onCommit={(v) => actions.setText(selection, v)} />
      </Field>
      <p className="hint">Nodes written between <code>subgraph</code> and <code>end</code> belong to it.</p>
      <LinkButton onClick={() => actions.deleteSelection(selection)}>Remove subgraph, keep nodes</LinkButton>
      <LinkButton danger onClick={() => flowActions.deleteSubgraphWithContents(id)}>Delete subgraph and nodes</LinkButton>
    </InspectorPanel>
  );
}

export function FlowInspector({ selection }: { selection: Selection }) {
  const edge = useStore((s) => (selection.kind === 'edge' ? s.flow?.edges[selection.index] : undefined));
  switch (selection.kind) {
    case 'node':
      return <NodePanel selection={selection} id={selection.id} />;
    case 'edge':
      return edge ? <EdgePanel selection={selection} e={edge} /> : null;
    case 'subgraph':
      return <SubgraphPanel selection={selection} id={selection.id} />;
    default:
      return null;
  }
}
