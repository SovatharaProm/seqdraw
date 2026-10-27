import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icons } from '../icons';

// Dropdown menu
export function Menu({ label, title, align, caret = true, children }: { label: ReactNode; title?: string; align?: 'right'; caret?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button title={title} aria-label={caret ? undefined : title} className={`${open ? 'active' : ''} ${caret ? '' : 'icon-btn'}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        {label}
        {caret && <span className="caret"><Icons.chevronDown /></span>}
      </button>
      {open && <div className={`menu-pop ${align ?? ''}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
