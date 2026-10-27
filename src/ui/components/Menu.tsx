import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { Icons } from '../icons';

const OUT_MS = 110;

// Dropdown menu
export function Menu({ label, title, align, caret = true, children }: { label: ReactNode; title?: string; align?: 'right'; caret?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const exit = useExitAnimation(OUT_MS);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => exit.leave(() => setOpen(false));
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && closeRef.current();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (open && !exit.leaving) return close();
    exit.cancel();
    setOpen(true);
  };
  const shown = open && !exit.leaving;

  return (
    <div className="menu" ref={ref}>
      <button title={title} aria-label={caret ? undefined : title} className={`${shown ? 'active' : ''} ${caret ? '' : 'icon-btn'}`} onClick={toggle} aria-expanded={shown}>
        {label}
        {caret && <span className={`caret${shown ? ' open' : ''}`}><Icons.chevronDown /></span>}
      </button>
      {open && <div className={`menu-pop ${align ?? ''}${exit.leaving ? ' leaving' : ''}`}>{children(close)}</div>}
    </div>
  );
}
