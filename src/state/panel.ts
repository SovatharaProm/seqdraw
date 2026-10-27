// Code panel and canvas bar state
import { create } from 'zustand';
import { requestFit } from '../lib/fit';
import { readBool, readNumber, readString, writeBool, writeString } from '../lib/storage';
import { useStore } from './store';

export const CODE_SIZE = 13;
export const CODE_SIZE_RANGE = [9, 24] as const;
export const SPLIT = 34;
const SPLIT_RANGE = [15, 80] as const;

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, n));

export type BarPosition = 'top' | 'bottom';

interface PanelState {
  open: boolean;
  // Get code dialog
  getCode: boolean;
  // Code font size (px)
  size: number;
  // Panel width (%)
  split: number;
  setOpen(open: boolean): void;
  setGetCode(open: boolean): void;
  setSize(size: number): void;
  setSplit(split: number, persist?: boolean): void;
  // Hand / zoom bar on the canvas
  zoomBar: BarPosition;
  setZoomBar(pos: BarPosition): void;
}

export const usePanel = create<PanelState>((set) => ({
  open: readBool('codeOpen', true),
  getCode: false,
  size: clamp(Math.round(readNumber('codeSize', CODE_SIZE)), CODE_SIZE_RANGE),
  split: clamp(readNumber('codeSplit', SPLIT), SPLIT_RANGE),
  zoomBar: readString('zoomBar') === 'bottom' ? 'bottom' : 'top',
  setZoomBar(zoomBar) {
    set({ zoomBar });
    writeString('zoomBar', zoomBar);
  },
  setOpen(open) {
    if (!open) useStore.getState().flush();
    set({ open, getCode: false });
    writeBool('codeOpen', open);
    requestAnimationFrame(requestFit);
  },
  setGetCode(getCode) {
    set({ getCode });
  },
  setSize(size) {
    size = clamp(Math.round(size), CODE_SIZE_RANGE);
    set({ size });
    writeString('codeSize', String(size));
  },
  setSplit(split, persist = true) {
    split = clamp(split, SPLIT_RANGE);
    set({ split });
    if (persist) writeString('codeSplit', String(split));
  },
}));
