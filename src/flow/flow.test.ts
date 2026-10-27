import { describe, expect, it } from 'vitest';
import { addEdge, addNode, deleteEdge, deleteNode, reverseEdge, setDirection, setEdge, setNodeLabel, setNodeShape, unwrapSubgraph } from './ops';
import { parseFlow, parseFlowStatement } from './parser';
import { formatFlowStatement, serializeFlow } from './serializer';
import { edgeKeys, layoutFlow, nearestSide, orthoRoute, portPoint } from './layout';
import { detectKind, isBlankDiagram, startCode } from '../core/diagram';
import { setConfigTheme } from '../core/ops';
import { parse } from '../core/parser';
import { serialize } from '../core/serializer';

const code = (lines: string[]) => lines.join('\n');
const roundTrip = (s: string) => formatFlowStatement(parseFlowStatement(s));

describe('flowchart parser', () => {
  it('reads the header and direction', () => {
    expect(parseFlow('flowchart LR\n  A --> B').dir).toBe('LR');
    expect(parseFlow('graph TD;\n  A --> B').dir).toBe('TD');
    expect(parseFlow('graph\n  A').dir).toBe('TB');
    expect(parseFlow('flowchart LR\n  A --> B').errors).toEqual([]);
  });

  it('reads node shapes', () => {
    const doc = parseFlow(code(['flowchart TD', '  a[Rect] --> b(Round)', '  c([Stadium]) --> d[[Sub]]', '  e[(DB)] --> f((Circle))', '  g{Q?} --> h{{Hex}}', '  i[/In/] --> j[\\Out\\]', '  k[/Trap\\] --> l[\\Inv/]', '  m>Flag] --> n(((Stop)))', '  o["Quoted (text)"]']));
    expect(doc.errors).toEqual([]);
    const shape = Object.fromEntries(doc.nodes.map((n) => [n.id, n.shape]));
    expect(shape).toEqual({
      a: 'rect', b: 'round', c: 'stadium', d: 'subroutine', e: 'cylinder', f: 'circle', g: 'diamond', h: 'hexagon',
      i: 'parallelogram', j: 'parallelogram-alt', k: 'trapezoid', l: 'trapezoid-alt', m: 'asymmetric', n: 'double-circle', o: 'rect',
    });
    expect(doc.nodes.find((n) => n.id === 'o')!.label).toBe('Quoted (text)');
  });

  it('reads @{} shapes', () => {
    const doc = parseFlow('flowchart TD\n  A@{ shape: diam, label: "Ok?" } --> B');
    expect(doc.nodes[0]).toMatchObject({ shape: 'diamond', label: 'Ok?' });
  });

  it('reads all link types and labels', () => {
    const doc = parseFlow(code(['flowchart LR', '  A --> B', '  A --- B', '  A -.-> B', '  A ==> B', '  A --o B', '  A --x B', '  A <--> B', '  A ~~~ B', '  A ---> B', '  A -->|yes| B', '  A -- no --> B', '  A -. maybe .-> B', '  A == sure ==> B']));
    expect(doc.errors).toEqual([]);
    const s = doc.edges.map((e) => `${e.spec.stroke}:${e.spec.start}:${e.spec.end}:${e.spec.length}:${e.spec.text ?? ''}`);
    expect(s).toEqual([
      'normal:none:arrow:1:', 'normal:none:none:1:', 'dotted:none:arrow:1:', 'thick:none:arrow:1:', 'normal:none:circle:1:', 'normal:none:cross:1:',
      'normal:arrow:arrow:1:', 'invisible:none:none:1:', 'normal:none:arrow:2:', 'normal:none:arrow:1:yes', 'normal:none:arrow:1:no',
      'dotted:none:arrow:1:maybe', 'thick:none:arrow:1:sure',
    ]);
  });

  it('expands chains and & groups', () => {
    const doc = parseFlow('flowchart TD\n  A --> B --> C\n  D & E --> F & G');
    expect(doc.edges.map((e) => `${e.from}${e.to}`)).toEqual(['AB', 'BC', 'DF', 'DG', 'EF', 'EG']);
  });

  it('reads subgraphs, classes and styles', () => {
    const doc = parseFlow(code(['flowchart TB', '  c1 --> a2', '  subgraph one [First]', '    direction LR', '    a1 --> a2', '    subgraph inner', '      x', '    end', '  end', '  classDef hot fill:#f96', '  class a1 hot', '  b:::hot', '  style c1 stroke:#333', '  linkStyle 0 stroke:red']));
    expect(doc.errors).toEqual([]);
    const one = doc.subgraphs.find((s) => s.id === 'one')!;
    expect(one).toMatchObject({ title: 'First', dir: 'LR' });
    expect(doc.subgraphs.find((s) => s.id === 'inner')!.parent).toBe('one');
    const parent = Object.fromEntries(doc.nodes.map((n) => [n.id, n.parent]));
    expect(parent).toMatchObject({ a1: 'one', a2: 'one', x: 'inner', c1: undefined });
    expect(doc.nodes.find((n) => n.id === 'a1')!.classes).toEqual(['hot']);
    expect(doc.nodes.find((n) => n.id === 'b')!.classes).toEqual(['hot']);
    expect(doc.nodes.find((n) => n.id === 'c1')!.style).toBe('stroke:#333');
    expect(doc.edges[0].style).toBe('stroke:red');
  });

  it('splits ; statements', () => {
    const doc = parseFlow('graph TD;\n  A-->B; B-->C;');
    expect(doc.errors).toEqual([]);
    expect(doc.edges).toHaveLength(2);
    expect(doc.edges[1].part).toBe(1);
  });

  it('reports errors', () => {
    expect(parseFlow('flowchart TD\n  subgraph x\n  A').errors[0].message).toMatch(/never closed/);
    expect(parseFlow('flowchart TD\n  end').errors[0].message).toMatch(/without/);
    expect(parseFlow('flowchart TD\n  A -->').errors[0].message).toMatch(/Unrecognized/);
  });
});

describe('flowchart serializer', () => {
  it('round-trips statements', () => {
    for (const s of ['A[Start] --> B{Ok?}', 'A -->|yes| B', 'A -. maybe .-> B', 'A == sure ==> B', 'A o--o B', 'A <-.-> B', 'A ~~~ B', 'A & B --> C', 'A ---> B', 'A(["Hi (there)"])', 'subgraph one [First]', 'classDef hot fill:#f96'])
      expect(roundTrip(s)).toBe(s);
  });

  it('keeps untouched lines', () => {
    const src = 'flowchart LR\n\tA-->B\n  %% note\n    C[Hi]';
    expect(serializeFlow(parseFlow(src).lines)).toBe(src);
  });
});

describe('flowchart ops', () => {
  const src = code(['flowchart TD', '    A[Start] --> B{Ok?}', '    B -->|yes| C[Done]', '    B -->|no| A']);

  it('renames and reshapes nodes', () => {
    const doc = parseFlow(src);
    expect(serializeFlow(setNodeLabel(doc, 'B', 'Valid?'))).toContain('A[Start] --> B{Valid?}');
    expect(serializeFlow(setNodeShape(doc, 'C', 'stadium'))).toContain('C([Done])');
    // Label added to a bare ref
    const bare = parseFlow('flowchart TD\n    X --> Y');
    expect(serializeFlow(setNodeLabel(bare, 'Y', 'Why (not)'))).toContain('X --> Y["Why (not)"]');
  });

  it('adds nodes and edges before trailing styles', () => {
    const doc = parseFlow(src + '\n    classDef hot fill:#f96');
    const { lines, id } = addNode(doc, 'diamond', 'Check');
    const out = serializeFlow(lines).split('\n');
    expect(out[out.length - 2]).toBe(`    ${id}{Check}`);
    expect(serializeFlow(addEdge(parseFlow(src), 'C', 'A').lines)).toMatch(/C --> A$/);
  });

  it('edits and deletes edges', () => {
    const doc = parseFlow(src);
    expect(serializeFlow(setEdge(doc, 1, { text: 'ok', stroke: 'dotted' }))).toContain('B -.->|ok| C[Done]');
    expect(serializeFlow(setEdge(doc, 2, { to: 'C' }))).toContain('B -->|no| C');
    expect(serializeFlow(reverseEdge(doc, 0))).toContain('B{Ok?} --> A[Start]');
    const chain = parseFlow('flowchart TD\n    A --> B --> C');
    expect(serializeFlow(deleteEdge(chain, 1))).toBe('flowchart TD\n    A --> B\n    C');
    expect(serializeFlow(deleteEdge(parseFlow('flowchart TD\n    A --> B --> C'), 0))).toBe('flowchart TD\n    A\n    B --> C');
    // Labelled ends stay, one per line
    expect(serializeFlow(deleteEdge(parseFlow('flowchart TD\n    A[x] --> B[y]'), 0))).toBe('flowchart TD\n    A[x]\n    B[y]');
    // Moving an end keeps the old node's label
    expect(serializeFlow(setEdge(parseFlow('flowchart TD\n    A --> B[Bee]'), 0, { to: 'C' }))).toBe('flowchart TD\n    A --> C\n    B[Bee]');
    // Reconnect inside a chain
    expect(serializeFlow(setEdge(parseFlow('flowchart TD\n    A --> B --> C'), 1, { to: 'A' }))).toBe('flowchart TD\n    A --> B --> A');
  });

  it('deletes nodes everywhere', () => {
    const doc = parseFlow(src + '\n    style B fill:#fff\n    class A,B hot');
    const out = serializeFlow(deleteNode(doc, 'B'));
    expect(out).toBe(code(['flowchart TD', '    A[Start]', '    C[Done]', '    class A hot']));
  });

  it('unwraps subgraphs and sets direction', () => {
    const doc = parseFlow('flowchart TD\n    subgraph g [G]\n        A\n    end');
    expect(serializeFlow(unwrapSubgraph(doc, 'g'))).toBe('flowchart TD\n    A');
    expect(serializeFlow(setDirection(doc, 'LR')).split('\n')[0]).toBe('flowchart LR');
  });
});

describe('flowchart layout', () => {
  it('places nodes along the direction', () => {
    const td = layoutFlow(parseFlow('flowchart TD\n  A --> B'), {});
    const [a, b] = td.nodes;
    expect(b.y).toBeGreaterThan(a.y);
    const lr = layoutFlow(parseFlow('flowchart LR\n  A --> B'), {});
    expect(lr.nodes[1].x).toBeGreaterThan(lr.nodes[0].x);
    expect(lr.edges[0].points.length).toBeGreaterThanOrEqual(2);
  });

  it('wraps subgraph children', () => {
    const L = layoutFlow(parseFlow('flowchart TD\n  subgraph g [Group]\n    A --> B\n  end\n  C --> A'), {});
    const g = L.clusters[0];
    for (const n of L.nodes.filter((n) => n.id !== 'C')) {
      expect(n.x - n.width / 2).toBeGreaterThanOrEqual(g.x);
      expect(n.y + n.height / 2).toBeLessThanOrEqual(g.y + g.height);
    }
  });

  it('keeps placed nodes and places new ones beside a neighbour', () => {
    const placed = { A: { x: 300, y: 40 }, B: { x: 200, y: 160 }, C: { x: 400, y: 160 } };
    // New node D from B, and a link that would reshuffle dagre
    const L = layoutFlow(parseFlow('flowchart TD\n  A --> B\n  A --> C\n  B --> D\n  C --> B'), placed);
    const at = (id: string) => L.nodes.find((n) => n.id === id)!;
    expect([at('A').x, at('A').y, at('B').x, at('C').x]).toEqual([300, 40, 200, 400]);
    expect(at('D').x).toBe(200);
    expect(at('D').y).toBeGreaterThan(at('B').y + at('B').height / 2);
  });
});

describe('diagram kind', () => {
  it('detects flowcharts', () => {
    expect(detectKind('flowchart TD\n A')).toBe('flowchart');
    expect(detectKind('---\ntitle: x\n---\n%% hi\ngraph LR')).toBe('flowchart');
    expect(detectKind('sequenceDiagram\n A->>B: hi')).toBe('sequence');
    expect(detectKind('')).toBe('sequence');
  });
});

describe('flowchart export', () => {
  it('renders a clean standalone SVG', async () => {
    const { svgString } = await import('../io/export');
    const { THEMES } = await import('../core/themes');
    const svg = svgString(layoutFlow(parseFlow('flowchart LR\n  A[Start] -->|go| B{Ok?}\n  subgraph g [G]\n    B\n  end'), {}), THEMES.redux);
    expect(svg).toMatch(/^<\?xml[\s\S]*<svg/);
    expect(svg).toContain('Start');
    expect(svg).not.toMatch(/data-(kind|id|line)=/);
    expect(svg).not.toContain('class="hit"');
  });
});

describe('flowchart ports', () => {
  it('keys edges stably', () => {
    expect(edgeKeys(parseFlow('flowchart TD\n  A --> B\n  A --> B\n  B --> C'))).toEqual(['A->B#0', 'A->B#1', 'B->C#0']);
  });

  it('snaps to the nearest side', () => {
    const n = { x: 0, y: 0, width: 100, height: 40 };
    expect(nearestSide(n, { x: 60, y: 5 })).toBe('right');
    expect(nearestSide(n, { x: -5, y: 30 })).toBe('bottom');
    expect(portPoint(n, 'left')).toEqual({ x: -50, y: 0 });
  });

  it('routes orthogonally and leaves perpendicular', () => {
    const pts = orthoRoute({ x: 0, y: 0 }, 'right', { x: 100, y: 80 }, 'top');
    for (let i = 1; i < pts.length; i++) expect(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y).toBe(true);
    // One clean elbow
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }]);
  });

  it('uses pinned sides in layout', () => {
    const doc = parseFlow('flowchart TD\n  A --> B');
    const L = layoutFlow(doc, {}, undefined, { 'A->B#0': { from: 'right', to: 'right' } });
    const [a, b] = L.nodes;
    const e = L.edges[0];
    expect(e.ortho).toBe(true);
    expect(e.points[0]).toEqual(portPoint(a, 'right'));
    expect(e.points[e.points.length - 1]).toEqual(portPoint(b, 'right'));
  });
});

describe('free link ends', () => {
  it('reads and writes a blank text node', () => {
    const doc = parseFlow('flowchart TD\n    A --> free1\n    free1@{ shape: text, label: " " }');
    const free = doc.nodes.find((n) => n.id === 'free1')!;
    expect(free).toMatchObject({ shape: 'text', label: '' });
    expect(doc.errors).toEqual([]);
    expect(roundTrip('free1@{ shape: text, label: " " }')).toBe('free1@{ shape: text, label: " " }');
    // Tiny in layout
    const L = layoutFlow(doc, {});
    expect(L.nodes.find((n) => n.id === 'free1')!.width).toBe(2);
  });
});

describe('blank start', () => {
  it('detects blank code', () => {
    expect(isBlankDiagram('')).toBe(true);
    expect(isBlankDiagram('---\nconfig:\n  theme: neo\n---\nflowchart TD\n    ')).toBe(true);
    expect(isBlankDiagram('flowchart TD\n    A --> B')).toBe(false);
  });
  it('adds the header after frontmatter', () => {
    const code = startCode('---\nconfig:\n  theme: neo\n---\n', 'flowchart');
    expect(code).toBe('---\nconfig:\n  theme: neo\n---\nflowchart TD');
    expect(detectKind(code)).toBe('flowchart');
    expect(startCode('flowchart TD', 'sequence')).toBe('sequenceDiagram');
  });
  it('empty code has no errors', () => {
    expect(parse('').errors).toEqual([]);
    expect(parse(serialize(setConfigTheme(parse(''), 'neo'))).config.theme).toBe('neo');
  });
});

describe('blank shapes', () => {
  it('adds a shape without a label', () => {
    const { lines, id } = addNode(parseFlow('flowchart TD\n    A --> B'), 'circle', ' ');
    const code = serializeFlow(lines);
    expect(code).toContain(`${id}((" "))`);
    const doc = parseFlow(code);
    expect(doc.nodes.find((n) => n.id === id)!.label.trim()).toBe('');
    const n = layoutFlow(doc, {}, (t) => t.length * 7).nodes.find((q) => q.id === id)!;
    expect(n.width).toBeGreaterThan(60);
  });
});
