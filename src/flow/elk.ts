// Adaptive layout: ELK layered (Mermaid's `layout: elk`), loaded on demand
import type { FlowLayout, Pt } from './layout';
import type { FlowDir, FlowDoc } from './model';

type Box = { x: number; y: number; width: number; height: number };

// Positions and routes from ELK
export interface AutoLayout {
  nodes: Record<string, Pt>;
  edges: Record<number, { points: Pt[]; label?: Pt }>;
  clusters: Record<string, Box>;
}

// Layout engines (registry)
export const LAYOUT_ENGINES = [
  { id: 'dagre', name: 'Hierarchical', hint: 'Arranges nodes in ordered levels following their hierarchy.' },
  { id: 'elk', name: 'Adaptive', hint: 'Rearranges nodes based on their context to keep the diagram organized.' },
] as const;

export type LayoutEngine = (typeof LAYOUT_ENGINES)[number]['id'];

export const engineOf = (doc: FlowDoc): LayoutEngine => (doc.config.layout === 'elk' ? 'elk' : 'dagre');

const DIRECTION: Record<FlowDir, string> = { TB: 'DOWN', TD: 'DOWN', BT: 'UP', LR: 'RIGHT', RL: 'LEFT' };
const TITLE_PAD = 36;
const PAD = 16;

const OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.spacing.nodeNodeBetweenLayers': '50',
  'elk.spacing.nodeNode': '40',
  'elk.spacing.edgeNode': '20',
  'elk.spacing.edgeEdge': '14',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20',
  'elk.edgeLabels.inline': 'true',
};

// What ELK's result depends on (cache key)
export function layoutSignature(doc: FlowDoc, base: FlowLayout): string {
  return JSON.stringify([
    doc.dir,
    base.nodes.map((n) => [n.id, n.width, n.height, n.parent]),
    base.edges.map((e) => [e.index, e.from, e.to, e.labelBox?.width, e.labelBox?.height]),
    doc.subgraphs.map((s) => [s.id, s.parent, s.title]),
  ]);
}

type ElkNode = { id: string; width?: number; height?: number; x?: number; y?: number; children?: ElkNode[]; layoutOptions?: Record<string, string> };

export async function elkLayout(doc: FlowDoc, base: FlowLayout): Promise<AutoLayout> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();
  // Nest nodes inside their subgraphs
  const byId = new Map<string, ElkNode>();
  const root: ElkNode = { id: 'root', children: [], layoutOptions: { ...OPTIONS, 'elk.direction': DIRECTION[doc.dir] } };
  for (const s of doc.subgraphs) byId.set(s.id, { id: s.id, children: [], layoutOptions: { 'elk.padding': `[top=${TITLE_PAD},left=${PAD},bottom=${PAD},right=${PAD}]` } });
  for (const n of base.nodes) byId.set(n.id, { id: n.id, width: n.width, height: n.height });
  const parentOf = (id: string) => base.nodes.find((n) => n.id === id)?.parent ?? doc.subgraphs.find((s) => s.id === id)?.parent;
  // Code order (ELK keeps it): a subgraph goes in where its first node appears
  const placed = new Set<string>();
  const place = (id: string) => {
    if (placed.has(id)) return;
    const p = parentOf(id);
    if (p && byId.has(p)) place(p);
    placed.add(id);
    (p && byId.get(p)?.children ? byId.get(p)!.children! : root.children!).push(byId.get(id)!);
  };
  base.nodes.forEach((n) => place(n.id));
  doc.subgraphs.forEach((sg) => place(sg.id));
  // Empty subgraphs need a size
  for (const s of doc.subgraphs) {
    const n = byId.get(s.id)!;
    if (!n.children!.length) Object.assign(n, { width: 120, height: TITLE_PAD + 24 });
  }
  const edges = base.edges
    .filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => ({
      id: `e${e.index}`,
      sources: [e.from],
      targets: [e.to],
      // Needs text to be placed
      labels: e.labelBox ? [{ id: `l${e.index}`, text: e.label.join(' '), width: e.labelBox.width, height: e.labelBox.height, layoutOptions: { 'elk.edgeLabels.placement': 'CENTER' } }] : [],
    }));
  const out = await elk.layout({ ...root, edges } as never);

  const result: AutoLayout = { nodes: {}, edges: {}, clusters: {} };
  // Absolute origin of every container (edges are relative to theirs)
  const origin = new Map<string, Pt>([['root', { x: 0, y: 0 }]]);
  const walk = (n: ElkNode, ox: number, oy: number) => {
    for (const c of n.children ?? []) {
      const box = { x: ox + (c.x ?? 0), y: oy + (c.y ?? 0), width: c.width ?? 0, height: c.height ?? 0 };
      origin.set(c.id, { x: box.x, y: box.y });
      if (doc.subgraphs.some((s) => s.id === c.id)) result.clusters[c.id] = box;
      else result.nodes[c.id] = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      walk(c, box.x, box.y);
    }
  };
  walk(out as ElkNode, 0, 0);
  type ElkEdge = { id: string; container?: string; sections?: { startPoint: Pt; endPoint: Pt; bendPoints?: Pt[] }[]; labels?: Box[] };
  const allEdges: ElkEdge[] = [];
  const collect = (n: { edges?: ElkEdge[]; children?: unknown[] }) => {
    allEdges.push(...(n.edges ?? []));
    (n.children as { edges?: ElkEdge[]; children?: unknown[] }[] | undefined)?.forEach(collect);
  };
  collect(out as never);
  for (const e of allEdges) {
    const s = e.sections?.[0];
    if (!s) continue;
    const l = e.labels?.[0];
    const o = origin.get(e.container ?? 'root') ?? { x: 0, y: 0 };
    const abs = (p: Pt) => ({ x: p.x + o.x, y: p.y + o.y });
    result.edges[Number(e.id.slice(1))] = {
      points: [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map(abs),
      label: l ? abs({ x: l.x + l.width / 2, y: l.y + l.height / 2 }) : undefined,
    };
  }
  return result;
}
