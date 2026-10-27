// Project files
import { emptyOverrides, type LayoutOverrides } from '../core/model';
import type { ProjectData } from '../state/store';

export const PROJECT_EXT = '.seqd';
const APP_ID = 'seqdraw';
const VERSION = 1;

interface ProjectFile {
  app: typeof APP_ID;
  version: number;
  savedAt: string;
  theme: string;
  code: string;
  layout: LayoutOverrides;
}

export function toProjectJson(data: ProjectData): string {
  const file: ProjectFile = {
    app: APP_ID,
    version: VERSION,
    savedAt: new Date().toISOString(),
    theme: data.theme ?? '',
    code: data.code,
    layout: data.overrides,
  };
  return JSON.stringify(file, null, 2);
}

function fromProjectJson(text: string): ProjectData | null {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  const f = obj as Partial<ProjectFile>;
  if (!f || f.app !== APP_ID || typeof f.code !== 'string') return null;
  if ((f.version ?? 1) > VERSION) throw new Error('This file was saved by a newer version of SeqDraw.');
  return {
    code: f.code,
    theme: typeof f.theme === 'string' ? f.theme : '',
    overrides: { ...emptyOverrides(), ...(f.layout ?? {}) },
  };
}

// Code from text
function codeFromText(text: string): string {
  const fence = text.match(/```mermaid\s*\n([\s\S]*?)```/);
  return (fence ? fence[1] : text).replace(/\s+$/, '');
}

// Editable SVG / PNG

const SVG_META = /<metadata id="seqdraw-project">([\s\S]*?)<\/metadata>/;

export function embedInSvg(svg: string, data: ProjectData): string {
  const json = toProjectJson(data).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return svg.replace(/(<svg[^>]*>)/, `$1<metadata id="seqdraw-project">${json}</metadata>`);
}

function extractFromSvg(svg: string): ProjectData | null {
  const m = svg.match(SVG_META);
  if (!m) return null;
  const json = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return fromProjectJson(json);
}

const PNG_KEY = 'seqdraw';
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function toBase64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const fromBase64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

// Embed in PNG
export async function embedInPng(png: Blob, data: ProjectData): Promise<Blob> {
  const bytes = new Uint8Array(await png.arrayBuffer());
  const payload = new TextEncoder().encode(`${PNG_KEY}\0${toBase64(toProjectJson(data))}`);
  const chunk = new Uint8Array(12 + payload.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length);
  chunk.set(new TextEncoder().encode('tEXt'), 4);
  chunk.set(payload, 8);
  view.setUint32(8 + payload.length, crc32(chunk.subarray(4, 8 + payload.length)));
  const ihdrEnd = 8 + 25; // signature + IHDR
  return new Blob([bytes.subarray(0, ihdrEnd), chunk, bytes.subarray(ihdrEnd)], { type: 'image/png' });
}

function extractFromPng(bytes: Uint8Array): ProjectData | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 8;
  while (off + 8 <= bytes.length) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(...bytes.subarray(off + 4, off + 8));
    if (type === 'tEXt') {
      const body = new TextDecoder('latin1').decode(bytes.subarray(off + 8, off + 8 + len));
      const sep = body.indexOf('\0');
      if (body.slice(0, sep) === PNG_KEY) return fromProjectJson(fromBase64(body.slice(sep + 1)));
    }
    if (type === 'IEND') break;
    off += 12 + len;
  }
  return null;
}

// Open file
export async function openFile(file: File): Promise<ProjectData> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) {
    const data = extractFromPng(new Uint8Array(await file.arrayBuffer()));
    if (!data) throw new Error('This PNG has no embedded SeqDraw diagram. Only PNGs exported with "Editable" can be reopened.');
    return data;
  }
  const text = await file.text();
  if (name.endsWith('.svg') || text.trimStart().startsWith('<svg') || text.trimStart().startsWith('<?xml')) {
    const data = extractFromSvg(text);
    if (!data) throw new Error('This SVG has no embedded SeqDraw diagram.');
    return data;
  }
  const project = fromProjectJson(text);
  if (project) return project;
  if (text.trimStart().startsWith('{')) throw new Error('This JSON file is not a SeqDraw project.');
  return { code: codeFromText(text), overrides: emptyOverrides(), theme: '' };
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.(seqd|json|mmd|mermaid|md|txt|svg|png)$/i, '') || 'untitled';
}
