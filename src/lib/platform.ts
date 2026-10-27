// Shortcut labels per platform (bindings accept both ⌘ and Ctrl)
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

const WINDOWS_KEYS: [RegExp, string][] = [
  [/⌘\/Ctrl/g, 'Ctrl'],
  [/⇧⌘/g, 'Ctrl+Shift+'],
  [/⌘\+/g, 'Ctrl+Plus'],
  [/⌘[−-]/g, 'Ctrl+Minus'],
  [/⌘↵/g, 'Ctrl+Enter'],
  [/⌘/g, 'Ctrl+'],
  [/⇧/g, 'Shift+'],
];

// "⇧⌘Z" -> "Ctrl+Shift+Z" on Windows / Linux
export const keys = (label: string): string => (IS_MAC ? label : WINDOWS_KEYS.reduce((s, [re, to]) => s.replace(re, to), label));
