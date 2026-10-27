import { requestFit } from '../lib/fit';
import { emptyOverrides } from '../core/model';
import { download, pdfBlob, pngBlob, projectBlob, svgString } from '../io/export';
import { PROJECT_EXT, baseName, openFile } from '../io/project';
import { current as S, type ProjectData } from '../state/store';
import { getEditorView } from '../editor/CodeEditor';
import { usePanel } from '../state/panel';
import { diagramTheme, diagramThemeId } from '../state/appearance';
import { toast } from '../state/toast';

const project = (): ProjectData => ({ code: S().code, overrides: S().overrides, theme: diagramThemeId() });
const theme = diagramTheme;

// Save handle
type SaveHandle = { createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }>; name: string };
let saveHandle: SaveHandle | null = null;
const fsApi = window as unknown as {
  showSaveFilePicker?: (o: object) => Promise<SaveHandle>;
};

function confirmDiscard(): boolean {
  return !S().dirty || window.confirm('You have unsaved changes. Discard them?');
}

export function newDiagram(code: string, name = 'untitled', mode?: 'draw' | 'code') {
  if (!confirmDiscard()) return;
  // Draw hides the code, Write shows it
  if (mode) usePanel.getState().setOpen(mode === 'code');
  saveHandle = null;
  S().load({ code, overrides: emptyOverrides() }, name);
  requestAnimationFrame(requestFit);
  if (mode === 'code') requestAnimationFrame(() => getEditorView()?.focus());
}

export async function loadFile(file: File) {
  if (!confirmDiscard()) return;
  try {
    const data = await openFile(file);
    saveHandle = null;
    S().load(data, baseName(file.name));
    requestAnimationFrame(requestFit);
    toast(`Opened ${file.name}`);
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

export function openDialog() {
  const input = Object.assign(document.createElement('input'), {
    type: 'file',
    accept: `${PROJECT_EXT},.json,.mmd,.mermaid,.md,.txt,.svg,.png`,
  });
  input.onchange = () => input.files?.[0] && loadFile(input.files[0]);
  input.click();
}

export async function save(saveAs = false) {
  const blob = projectBlob(project());
  const name = `${S().fileName}${PROJECT_EXT}`;
  try {
    if (fsApi.showSaveFilePicker) {
      if (!saveHandle || saveAs)
        saveHandle = await fsApi.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: 'SeqDraw diagram', accept: { 'application/json': [PROJECT_EXT] } }],
        });
      const w = await saveHandle.createWritable();
      await w.write(blob);
      await w.close();
      S().setFileName(baseName(saveHandle.name));
    } else download(blob, name);
    S().markSaved();
    toast('Saved to your computer');
  } catch (e) {
    if ((e as Error).name !== 'AbortError') toast(`Save failed: ${(e as Error).message}`, 'error');
  }
}

export type ExportFormat = 'svg' | 'png' | 'png-transparent' | 'pdf' | 'mmd' | 'copy-code' | 'copy-markdown' | 'copy-svg';

export async function exportAs(format: ExportFormat, opts: { embed: boolean; scale: number }) {
  const { code, fileName } = S();
  const layout = S().flowLayout ?? S().layout;
  const embed = opts.embed ? project() : undefined;
  try {
    switch (format) {
      case 'svg':
        return download(svgString(layout, theme(), { embed }), `${fileName}.svg`, 'image/svg+xml');
      case 'png':
      case 'png-transparent':
        return download(await pngBlob(layout, theme(), { scale: opts.scale, transparent: format === 'png-transparent', embed }), `${fileName}.png`);
      case 'pdf':
        return download(await pdfBlob(layout, theme()), `${fileName}.pdf`);
      case 'mmd':
        return download(code + '\n', `${fileName}.mmd`);
      case 'copy-code':
        await navigator.clipboard.writeText(code);
        return toast('Mermaid code copied');
      case 'copy-markdown':
        await navigator.clipboard.writeText('```mermaid\n' + code + '\n```\n');
        return toast('Markdown snippet copied — paste it into GitHub, GitLab, Notion…');
      case 'copy-svg':
        await navigator.clipboard.writeText(svgString(layout, theme()));
        return toast('SVG markup copied');
    }
  } catch (e) {
    toast(`Export failed: ${(e as Error).message}`, 'error');
  }
}
