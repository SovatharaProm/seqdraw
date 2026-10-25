// App appearance
import { create } from 'zustand';

export type Appearance = 'system' | 'light' | 'dark';

const KEY = 'seqdraw.appearance';

function read(): Appearance {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
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
    try {
      localStorage.setItem(KEY, appearance);
    } catch {
      // ignore
    }
    set({ appearance });
  },
}));

// Init appearance
export function initAppearance() {
  apply(useAppearance.getState().appearance);
}
