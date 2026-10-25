export const FONT_FAMILY = '"trebuchet ms", verdana, arial, sans-serif';
export const FONT_SIZE = 14;
export const LINE_HEIGHT = 18;

export type Measure = (text: string, bold?: boolean) => number;

let ctx: CanvasRenderingContext2D | null | undefined;

// Text measurer
export function measureFor(fontFamily: string, boldWeight: string | number = 'bold', upperLabels = false): Measure {
  return (text, bold = false) => {
    if (bold && upperLabels) text = text.toUpperCase();
    if (ctx === undefined) ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    if (!ctx) return text.length * FONT_SIZE * 0.55;
    ctx.font = `${bold ? `${boldWeight} ` : ''}${FONT_SIZE}px ${fontFamily}`;
    return ctx.measureText(text).width;
  };
}

export const measureText: Measure = measureFor(FONT_FAMILY);

// Split <br/> lines
export const splitLines = (text: string) => decodeEntities(text).split(/<br\s*\/?>/i);

export const decodeEntities = (text: string) => text.replace(/#(\d+);/g, (_, n) => String.fromCharCode(+n));

// Textbox text -> Mermaid text
export const toMermaidText = (text: string) => text.trim().replace(/;/g, '#59;').replace(/\r?\n/g, '<br/>');

// Mermaid text -> textbox text
export const fromMermaidText = (text: string) => splitLines(text).join('\n');
