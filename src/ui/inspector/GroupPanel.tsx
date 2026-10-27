import { keys } from '../../lib/platform';
import { deleteItems, duplicateSelection, selectedItems } from '../../state/clipboard';
import { IconButton, LinkButton } from '../components/Button';
import { Icons } from '../icons';

// Several items selected
export function GroupPanel({ count }: { count: number }) {
  return (
    <aside className="inspector" aria-label="Properties">
      <div className="inspector-head">
        <strong>{count} selected</strong>
        <IconButton className="icon" label="Delete" shortcut="Del" onClick={() => deleteItems(selectedItems())}><Icons.trash /></IconButton>
      </div>
      <p className="hint">{keys('Drag one to move them together. ⌘C / ⌘X / ⌘V to copy, cut, paste. Shift+click adds or removes one.')}</p>
      <LinkButton onClick={duplicateSelection}>Duplicate ({keys('⌘D')})</LinkButton>
    </aside>
  );
}
