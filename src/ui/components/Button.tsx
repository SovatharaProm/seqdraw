import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & { label: string; shortcut?: string; children: ReactNode };

// Icon-only button: label is the tooltip and the accessible name
export function IconButton({ label, shortcut, className = '', children, ...rest }: Props) {
  return (
    <button type="button" className={`icon-btn ${className}`} title={shortcut ? `${label} (${shortcut})` : label} aria-label={label} {...rest}>
      {children}
    </button>
  );
}

// Text-style action
export function LinkButton({ danger, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button type="button" className={`link${danger ? ' danger' : ''} ${className}`} {...rest}>
      {children}
    </button>
  );
}
