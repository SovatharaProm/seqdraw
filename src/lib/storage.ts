// Browser storage (fails quietly: private mode, blocked storage)

// Storage keys
export const STORAGE_KEYS = {
  draft: 'seqdraw.draft.v1',
  appearance: 'seqdraw.appearance',
  autoUpdate: 'seqdraw.autoUpdate',
  codeOpen: 'seqdraw.code.open',
  codeSize: 'seqdraw.code.size',
  codeSplit: 'seqdraw.code.split',
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;

export function readString(key: StorageKey): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS[key]);
  } catch {
    return null;
  }
}

export function writeString(key: StorageKey, value: string) {
  try {
    localStorage.setItem(STORAGE_KEYS[key], value);
  } catch {
    // ignore
  }
}

export const readBool = (key: StorageKey, fallback: boolean): boolean => {
  const v = readString(key);
  return v === null ? fallback : v !== '0';
};

export const writeBool = (key: StorageKey, value: boolean) => writeString(key, value ? '1' : '0');

export const readNumber = (key: StorageKey, fallback: number): number => {
  const n = Number(readString(key));
  return n > 0 ? n : fallback;
};

export function readJson<T>(key: StorageKey): T | null {
  try {
    return JSON.parse(readString(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

export const writeJson = (key: StorageKey, value: unknown) => writeString(key, JSON.stringify(value));
