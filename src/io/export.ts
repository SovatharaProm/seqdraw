import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Layout } from '../core/layout';
import type { Theme } from '../core/themes';
import { DiagramSvg } from '../render/DiagramSvg';
import type { ProjectData } from '../state/store';
import { embedInPng, embedInSvg, toProjectJson } from './project';

export function download(data: Blob | string, fileName: string, type = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function svgString(layout: Layout, theme: Theme, opts: { embed?: ProjectData; transparent?: boolean } = {}): string {
  let svg = renderToStaticMarkup(createElement(DiagramSvg, { layout, theme, background: !opts.transparent }));
  // Strip hit-test attributes
  svg = svg.replace(/ data-(kind|line|id)="[^"]*"/g, '').replace(/<path[^>]*class="hit"[^>]*(\/>|><\/path>)/g, '');
  if (opts.embed) svg = embedInSvg(svg, opts.embed);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
}

export async function pngBlob(layout: Layout, theme: Theme, opts: { scale: number; transparent?: boolean; embed?: ProjectData }): Promise<Blob> {
  const svg = svgString(layout, theme, { transparent: opts.transparent });
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await img.decode();
    const { width, height } = layout.bounds;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * opts.scale);
    canvas.height = Math.ceil(height * opts.scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'));
    return opts.embed ? embedInPng(blob, opts.embed) : blob;
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// PDF export
export async function pdfBlob(layout: Layout, theme: Theme): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const { width, height } = layout.bounds;
  const pdf = new jsPDF({ unit: 'pt', format: [width, height], orientation: width > height ? 'landscape' : 'portrait' });
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0';
  host.innerHTML = svgString(layout, theme).replace(/^<\?xml[^>]*>\s*/, '');
  document.body.appendChild(host);
  try {
    await svg2pdf(host.querySelector('svg')!, pdf, { x: 0, y: 0, width, height });
  } finally {
    host.remove();
  }
  return pdf.output('blob');
}

export function projectBlob(data: ProjectData): Blob {
  return new Blob([toProjectJson(data)], { type: 'application/json' });
}
