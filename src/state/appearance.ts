// App appearance
import { create } from 'zustand';
import { readString, writeString } from '../lib/storage';

export type Appearance = 'system' | 'light' | 'dark';

function read(): Appearance {
  const v = readString('appearance');
  return v === 'light' || v === 'dark' ? v : 'system';
}

function apply(a: Appearance) {
  const root = document.documentElement;
  if (a === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', a);
}

export const useAppearance = create<{ appearance: Appearance; setAppearance(a: Appearance): void }>((set) => ({
  appearance: read(),
  setAppearance(appearance) {
    apply(appearance);
    writeString('appearance', appearance);
    set({ appearance });
  },
}));

// Init appearance
export function initAppearance() {
  apply(useAppearance.getState().appearance);
}
