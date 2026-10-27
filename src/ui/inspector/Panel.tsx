import type { ReactNode } from 'react';
import * as actions from '../../state/actions';
import type { Selection } from '../../state/store';
import { IconButton } from '../components/Button';
import { Icons } from '../icons';

// Inspector frame: title, delete, fields
export function InspectorPanel({ title, selection, children }: { title: string; selection: Selection; children: ReactNode }) {
  return (
    <aside className="inspector" aria-label="Properties">
      <div className="inspector-head">
        <strong>{title}</strong>
        <IconButton className="icon" label="Delete" shortcut="Del" onClick={() => actions.deleteSelection(selection)}><Icons.trash /></IconButton>
      </div>
      {children}
    </aside>
  );
}
