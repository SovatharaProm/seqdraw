import { describe, expect, it } from 'vitest';
import { layoutDiagram } from './layout';
import { emptyOverrides } from './model';
import { addParticipant, deleteParticipant, moveLine, moveRange, renameParticipant, reorderParticipants, setConfigTheme, setParticipantKind, unwrapBlock } from './ops';
import { analyze, parse } from './parser';
import { PARTICIPANT_SHAPES } from './participants';
import { serialize } from './serializer';

const SAMPLE = `sequenceDiagram
    %% a comment
    title Login flow
    autonumber
    participant B as Browser
    actor U as User
    U->>B: Open page
    B->>+API: POST /login
    loop retry
        API-->>-B: 200 OK<br/>token
    end
    alt ok
        Note over B,API: cached
    else fail
        B-xAPI: abort
    end`;

describe('parser', () => {
  it('parses participants in order of first appearance', () => {
    const doc = parse(SAMPLE);
    expect(doc.errors).toEqual([]);
    expect(doc.participants.map((p) => [p.id, p.label, p.kind])).toEqual([
      ['B', 'Browser', 'participant'],
      ['U', 'User', 'actor'],
      ['API', 'API', 'participant'],
    ]);
    expect(doc.title).toBe('Login flow');
  });

  it('parses message arrows and activation markers', () => {
    const msgs = parse(SAMPLE).lines.map((l) => l.stmt).filter((s) => s.type === 'message');
    expect(msgs.map((m) => m.type === 'message' && [m.from, m.arrow, m.activation, m.to])).toEqual([
      ['U', '->>', undefined, 'B'],
      ['B', '->>', '+', 'API'],
      ['API', '-->>', '-', 'B'],
      ['B', '-x', undefined, 'API'],
    ]);
  });

  it('reports errors with line numbers', () => {
    const doc = parse('sequenceDiagram\n  A->>B: hi\n  wat\n  loop x');
    expect(doc.errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it('parses database participants', () => {
    const doc = parse('sequenceDiagram\n participant DB@{ "type": "database" } as Store');
    expect(doc.participants[0]).toMatchObject({ id: 'DB', label: 'Store', kind: 'database' });
  });

  it('moves a block with its contents', () => {
    const doc = parse('sequenceDiagram\n    A->>B: one\n    loop retry\n        A->>B: two\n    end\n    B->>A: three');
    const { lines, index } = moveRange(doc.lines, 2, 4, doc.lines.length);
    expect(index).toBe(3);
    expect(serialize(lines)).toBe('sequenceDiagram\n    A->>B: one\n    B->>A: three\n    loop retry\n        A->>B: two\n    end');
    expect(moveRange(doc.lines, 2, 4, 3).lines).toBe(doc.lines);
  });

  it('parses and writes every participant shape', () => {
    for (const { kind } of PARTICIPANT_SHAPES) {
      const doc = parse('sequenceDiagram\n participant X as Thing');
      const out = parse(serialize(setParticipantKind(doc, 'X', kind)));
      expect(out.participants[0]).toMatchObject({ id: 'X', label: 'Thing', kind });
    }
    expect(parse('sequenceDiagram\n participant Q@{ "type": "queue" }').participants[0].kind).toBe('queue');
  });
});

describe('serializer', () => {
  it('round-trips untouched code byte for byte', () => {
    expect(serialize(parse(SAMPLE).lines)).toBe(SAMPLE);
  });

  it('indents moved lines for their new block depth', () => {
    const doc = parse(SAMPLE);
    const from = doc.lines.findIndex((l) => l.raw?.includes('Open page'));
    const into = doc.lines.findIndex((l) => l.raw?.includes('200 OK'));
    const out = serialize(moveLine(doc.lines, from, into).lines);
    expect(out).toContain('    loop retry\n        U->>B: Open page\n        API-->>-B');
  });
});

describe('ops', () => {
  it('reorders participants by declaring them', () => {
    const doc = parse('sequenceDiagram\n    A->>B: hi\n    B->>C: yo');
    const out = parse(serialize(reorderParticipants(doc, ['C', 'A', 'B'])));
    expect(out.participants.map((p) => p.id)).toEqual(['C', 'A', 'B']);
    expect(out.errors).toEqual([]);
  });

  it('renames ids everywhere, or falls back to an alias', () => {
    const doc = parse('sequenceDiagram\n    A->>B: hi\n    Note over A: x');
    expect(serialize(renameParticipant(doc, 'A', 'Alice'))).toBe('sequenceDiagram\n    Alice->>B: hi\n    Note over Alice: x');
    const aliased = parse(serialize(renameParticipant(doc, 'A', 'Web: client')));
    expect(aliased.participants[0]).toMatchObject({ id: 'A', label: 'Web: client' });
  });

  it('adds a participant at a position', () => {
    const doc = parse('sequenceDiagram\n    A->>B: hi');
    const { lines, id } = addParticipant(doc, 'actor', 'New Guy', 1);
    const out = analyze(lines);
    expect(out.participants.map((p) => p.id)).toEqual(['A', id, 'B']);
    expect(out.participants[1]).toMatchObject({ label: 'New Guy', kind: 'actor' });
  });

  it('deletes a participant and its messages', () => {
    const doc = parse('sequenceDiagram\n    A->>B: hi\n    B->>C: yo\n    Note over B,C: n');
    expect(serialize(deleteParticipant(doc, 'B'))).toBe('sequenceDiagram\n    Note over C: n');
  });

  it('unwraps a block, keeping its contents', () => {
    const doc = parse(SAMPLE);
    const start = doc.lines.findIndex((l) => l.stmt.type === 'block' && l.stmt.kind === 'alt');
    const out = serialize(unwrapBlock(doc.lines, start));
    expect(out).toContain('    Note over B,API: cached\n    B-xAPI: abort');
    expect(parse(out).errors).toEqual([]);
  });
});

describe('layout', () => {
  it('positions participants left to right without overlap and nests frames', () => {
    const l = layoutDiagram(parse(SAMPLE), emptyOverrides());
    const [a, b, c] = l.participants;
    expect(a.x + a.width / 2).toBeLessThan(b.x - b.width / 2);
    expect(b.x + b.width / 2).toBeLessThan(c.x - c.width / 2);
    expect(l.frames).toHaveLength(2);
    expect(l.messages).toHaveLength(4);
    expect(l.messages.map((m) => m.number)).toEqual([1, 2, 3, 4]);
    expect(l.activations).toHaveLength(1);
    // messages go down
    const ys = l.messages.map((m) => m.y);
    expect([...ys].sort((x, y) => x - y)).toEqual(ys);
  });

  it('respects user-set participant gaps', () => {
    const doc = parse('sequenceDiagram\n A->>B: hi');
    const l = layoutDiagram(doc, { participants: { B: { gap: 500 } } });
    expect(l.participants[1].x - l.participants[0].x).toBe(500);
  });
});

describe('config / themes', () => {
  const FM = '---\nconfig:\n  theme: redux-color\n---\nsequenceDiagram\n    A->>B: hi';

  it('reads the theme from frontmatter and keeps it out of the statements', () => {
    const doc = parse(FM);
    expect(doc.errors).toEqual([]);
    expect(doc.config).toMatchObject({ theme: 'redux-color', themeLine: 2, frontmatter: [0, 3] });
    expect(doc.participants.map((p) => p.id)).toEqual(['A', 'B']);
    expect(serialize(doc.lines)).toBe(FM);
  });

  it('reads the theme from an init directive', () => {
    expect(parse(`%%{init: {'theme': 'forest'}}%%\nsequenceDiagram\n A->>B: x`).config.theme).toBe('forest');
  });

  it('reads a frontmatter title', () => {
    expect(parse('---\ntitle: Checkout\n---\nsequenceDiagram\n A->>B: x').title).toBe('Checkout');
  });

  it('adds, inserts into, and rewrites the config block', () => {
    const plain = parse('sequenceDiagram\n    A->>B: hi');
    expect(serialize(setConfigTheme(plain, 'neo'))).toBe('---\nconfig:\n  theme: neo\n---\nsequenceDiagram\n    A->>B: hi');
    expect(serialize(setConfigTheme(parse(FM), 'redux-dark'))).toBe(FM.replace('redux-color', 'redux-dark'));
    const titleOnly = parse('---\ntitle: T\n---\nsequenceDiagram\n A->>B: x');
    expect(parse(serialize(setConfigTheme(titleOnly, 'dark'))).config.theme).toBe('dark');
    const directive = parse(`%%{init: {"theme": "forest"}}%%\nsequenceDiagram\n A->>B: x`);
    expect(serialize(setConfigTheme(directive, 'base'))).toContain('"theme": "base"');
  });

  it('canvas edits leave the config block untouched', () => {
    const doc = parse(FM);
    expect(serialize(renameParticipant(doc, 'A', 'Alice'))).toBe(FM.replace('A->>B', 'Alice->>B'));
    expect(serialize(reorderParticipants(doc, ['B', 'A']))).toMatch(/^---\nconfig:\n  theme: redux-color\n---\nsequenceDiagram\n/);
  });
});
