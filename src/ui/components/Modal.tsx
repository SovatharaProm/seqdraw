import { useEffect, useRef, type ReactNode } from 'react';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { Icons } from '../icons';
import { IconButton } from './Button';

const OUT_MS = 140;

// Dialog with fade, X and Escape
export function Modal({ label, className = '', onClose, children }: { label: string; className?: string; onClose: () => void; children: ReactNode | ((close: () => void) => ReactNode) }) {
  const { leaving: closing, leave } = useExitAnimation(OUT_MS);
  const box = useRef<HTMLDivElement>(null);
  const close = () => leave(onClose);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className={`modal-backdrop${closing ? ' closing' : ''}`} onClick={close}>
      <div ref={box} tabIndex={-1} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <IconButton className="modal-x" label="Close" shortcut="Esc" onClick={close}><Icons.close /></IconButton>
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>
  );
}
