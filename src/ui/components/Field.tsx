import { useEffect, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

// Labelled form row
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

// On/off switch row
export function SwitchField({ label, on, onChange, title }: { label: string; on: boolean; onChange: (on: boolean) => void; title?: string }) {
  return (
    <label className="switch" title={title}>
      <button role="switch" aria-checked={on} className={on ? 'on' : ''} onClick={() => onChange(!on)}>
        <span />
      </button>
      {label}
    </label>
  );
}

// Two fields side by side
export const FieldPair = ({ children }: { children: ReactNode }) => <div className="field-pair">{children}</div>;

// Text input that commits on Enter or blur, Escape reverts
export function TextField({ value, onCommit, multiline, label }: { value: string; onCommit: (v: string) => void; multiline?: boolean; label: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => v !== value && onCommit(v);
  const props = {
    value: v,
    'aria-label': label,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
    onBlur: commit,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
        e.preventDefault();
        commit();
      }
      if (e.key === 'Escape') setV(value);
    },
  };
  return multiline ? <textarea rows={2} {...props} /> : <input {...props} />;
}

// Typed select over an option list
function Select<T extends string | number>({ value, options, onChange, label, disabled }: { value: T; options: readonly Option<T>[]; onChange: (v: T) => void; label?: string; disabled?: boolean }) {
  return (
    <select
      value={value}
      aria-label={label}
      disabled={disabled}
      onChange={(e) => {
        const o = options.find((q) => String(q.value) === e.target.value);
        if (o) onChange(o.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// Field with a select
export function SelectField<T extends string | number>({ label, ...rest }: { label: string; value: T; options: readonly Option<T>[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <Field label={label}>
      <Select label={label} {...rest} />
    </Field>
  );
}
