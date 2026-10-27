import { create } from 'zustand';
import { useStore } from '../state/store';

export type EditorTab = 'code' | 'snippets';

const CODE_KEY = 'seqdraw.code.open';

function readCodeOpen() {
  try {
    return localStorage.getItem(CODE_KEY) !== '0';
  } catch {
    return true;
  }
}

interface UiState {
  codeOpen: boolean;
  tab: EditorTab;
  help: boolean;
  command: boolean;
  setCodeOpen(open: boolean): void;
  setTab(tab: EditorTab): void;
  setHelp(open: boolean): void;
  setCommand(open: boolean): void;
}

// App chrome state
export const useUi = create<UiState>((set) => ({
  codeOpen: readCodeOpen(),
  tab: 'code',
  help: false,
  command: false,
  setCodeOpen(codeOpen) {
    if (!codeOpen) useStore.getState().flush();
    try {
      localStorage.setItem(CODE_KEY, codeOpen ? '1' : '0');
    } catch {
      // ignore
    }
    set({ codeOpen });
  },
  setTab: (tab) => set({ tab }),
  setHelp: (help) => set({ help }),
  setCommand: (command) => set({ command }),
}));
