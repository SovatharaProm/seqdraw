// Draft autosave
import { emptyOverrides } from '../core/model';
import { readJson, writeJson } from '../lib/storage';
import { useStore } from './store';

const DEBOUNCE_MS = 300;

interface Draft {
  code: string;
  overrides: ReturnType<typeof emptyOverrides>;
  theme: string;
  fileName: string;
  dirty: boolean;
}

function write() {
  const { code, pending, overrides, theme, fileName, dirty } = useStore.getState();
  const draft: Draft = { code: pending ?? code, overrides, theme, fileName, dirty };
  writeJson('draft', draft);
}

// Restore draft
export function restoreDraft() {
  const draft = readJson<Partial<Draft>>('draft');
  if (!draft || typeof draft.code !== 'string') return;
  const store = useStore.getState();
  store.load(
    {
      code: draft.code,
      overrides: { ...emptyOverrides(), ...(draft.overrides ?? {}) },
      theme: draft.theme ?? '',
    },
    draft.fileName || 'untitled',
  );
  useStore.setState({ dirty: !!draft.dirty });
}

// Autosave
export function startDraftAutosave() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((s, prev) => {
    if (s.code === prev.code && s.pending === prev.pending && s.overrides === prev.overrides && s.theme === prev.theme && s.fileName === prev.fileName && s.dirty === prev.dirty) return;
    clearTimeout(timer);
    timer = setTimeout(write, DEBOUNCE_MS);
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(timer);
    write();
  });
}
