// Diagram kind
export type DiagramKind = 'sequence' | 'flowchart';

// Kind registry
export const DIAGRAM_KINDS: Record<DiagramKind, { name: string; header: string; docs: string }> = {
  sequence: { name: 'Sequence diagram', header: 'sequenceDiagram', docs: 'https://mermaid.js.org/syntax/sequenceDiagram.html' },
  flowchart: { name: 'Flowchart', header: 'flowchart TD', docs: 'https://mermaid.js.org/syntax/flowchart.html' },
};

// First statement decides
export function detectKind(code: string): DiagramKind {
  const lines = code.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i]?.trim() === '---') {
    i++;
    while (i < lines.length && lines[i].trim() !== '---') i++;
    i++;
  }
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('%%')) continue;
    return /^(flowchart|graph)\b/.test(t) ? 'flowchart' : 'sequence';
  }
  return 'sequence';
}

const HEADER = /^(sequenceDiagram|(flowchart|graph)(\s+\S+)?)\s*;?$/;

// Frontmatter end (line index after it)
function bodyStart(lines: string[]): number {
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i]?.trim() !== '---') return 0;
  i++;
  while (i < lines.length && lines[i].trim() !== '---') i++;
  return i + 1;
}

// Last blank check (run by several store selectors per update)
let blankFor: string | null = null;
let blankResult = true;

// Nothing drawn yet
export function isBlankDiagram(code: string): boolean {
  if (code === blankFor) return blankResult;
  const lines = code.split(/\r?\n/);
  blankFor = code;
  blankResult = lines.slice(bodyStart(lines)).every((l) => {
    const t = l.trim();
    return !t || t.startsWith('%%') || HEADER.test(t);
  });
  return blankResult;
}

// Blank code with a kind's header
export function startCode(code: string, kind: DiagramKind): string {
  const lines = code.split(/\r?\n/);
  const start = bodyStart(lines);
  const head = lines.slice(0, start);
  const body = lines.slice(start).filter((l) => !HEADER.test(l.trim()) && l.trim());
  return [...head, DIAGRAM_KINDS[kind].header, ...body].join('\n');
}
