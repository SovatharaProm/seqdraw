// Auto-fit to text switch
import { usePanel } from '../../state/panel';
import { SwitchField } from '../components/Field';

// Turning it on also fits this shape now
export function FitTextSwitch({ onFit }: { onFit: () => void }) {
  const on = usePanel((s) => s.fitText);
  return <SwitchField label="Auto-fit to text" on={on} title="Resize shapes to fit their label when you edit it" onChange={(v) => (usePanel.getState().setFitText(v), v && onFit())} />;
}
