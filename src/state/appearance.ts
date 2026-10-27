// App appearance (also picks the diagram theme)
import { create } from 'zustand';
import { themeFor, themeIdFor, type Theme, type ThemeId } from '../core/themes';
import { readString, writeString } from '../lib/storage';

export type Appearance = 'light' | 'dark';

const DEFAULT_APPEARANCE: Appearance = 'light';

const read = (): Appearance => (readString('appearance') === 'dark' ? 'dark' : DEFAULT_APPEARANCE);

const apply = (a: Appearance) => document.documentElement.setAttribute('data-theme', a);

export const useAppearance = create<{ appearance: Appearance; setAppearance(a: Appearance): void; toggle(): void }>((set, get) => ({
  appearance: read(),
  setAppearance(appearance) {
    apply(appearance);
    writeString('appearance', appearance);
    set({ appearance });
  },
  toggle() {
    get().setAppearance(get().appearance === 'dark' ? 'light' : 'dark');
  },
}));

// Init appearance
export function initAppearance() {
  apply(useAppearance.getState().appearance);
}

// Diagram theme for the current appearance
export const useDiagramTheme = (): Theme => useAppearance((s) => themeFor(s.appearance === 'dark'));
export const diagramTheme = (): Theme => themeFor(useAppearance.getState().appearance === 'dark');
export const diagramThemeId = (): ThemeId => themeIdFor(useAppearance.getState().appearance === 'dark');
