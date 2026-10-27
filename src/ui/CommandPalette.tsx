import { CopyIcon, FileCodeIcon, FileImageIcon, FileTextIcon, FolderOpenIcon, HelpCircleIcon, MaximizeIcon, PanelLeftIcon, PlusIcon, RedoIcon, SaveIcon, UndoIcon } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command';
import { requestFit } from '../canvas/Canvas';
import { PARTICIPANT_SHAPES } from '../core/participants';
import { THEMES } from '../core/themes';
import { snippetPreview, useInsertSnippet } from '../editor/SnippetMenu';
import { SNIPPETS } from '../editor/snippets';
import { addItem, type PaletteItem } from '../state/actions';
import { useStore } from '../state/store';
import { useAppearance } from './appearance';
import { EXAMPLES } from './examples';
import { exportAs, newDiagram, openDialog, save } from './fileActions';
import { Icons } from './icons';
import { Swatch, THEME_GROUPS } from './ThemeBadge';
import { APPEARANCES } from './Toolbar';
import { useUi } from './uiState';

const BLOCKS: PaletteItem[] = ['loop', 'alt', 'opt', 'par', 'critical', 'break'];

// Command palette
export function CommandPalette() {
  const open = useUi((s) => s.command);
  const { setCommand, setCodeOpen, setHelp } = useUi.getState();
  const insert = useInsertSnippet();
  const codeOpen = useUi((s) => s.codeOpen);
  const run = (fn: () => void) => () => {
    setCommand(false);
    requestAnimationFrame(fn);
  };
  const exp = (f: Parameters<typeof exportAs>[0]) => run(() => exportAs(f, { embed: true, scale: 2 }));

  return (
    <CommandDialog open={open} onOpenChange={setCommand}>
      <CommandInput placeholder="Type a command, shape, snippet or theme…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="File">
          <CommandItem onSelect={run(() => save())}><SaveIcon /> Save <CommandShortcut>⌘S</CommandShortcut></CommandItem>
          <CommandItem onSelect={run(openDialog)}><FolderOpenIcon /> Open file… <CommandShortcut>⌘O</CommandShortcut></CommandItem>
          {EXAMPLES.map((ex) => (
            <CommandItem key={ex.name} value={`new ${ex.name}`} onSelect={run(() => newDiagram(ex.code))}><PlusIcon /> New: {ex.name}</CommandItem>
          ))}
          <CommandItem onSelect={exp('png')}><FileImageIcon /> Export PNG</CommandItem>
          <CommandItem onSelect={exp('svg')}><FileCodeIcon /> Export SVG</CommandItem>
          <CommandItem onSelect={exp('pdf')}><FileTextIcon /> Export PDF</CommandItem>
          <CommandItem onSelect={exp('copy-code')}><CopyIcon /> Copy Mermaid code</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Add to diagram">
          {PARTICIPANT_SHAPES.map((s) => {
            const G = Icons[s.kind];
            return <CommandItem key={s.kind} value={`add ${s.name}`} onSelect={run(() => addItem(s.kind))}><G /> Add {s.name.toLowerCase()} <CommandShortcut>{s.hint}</CommandShortcut></CommandItem>;
          })}
          <CommandItem value="add message" onSelect={run(() => addItem('message'))}><Icons.message /> Add message</CommandItem>
          <CommandItem value="add note" onSelect={run(() => addItem('note'))}><Icons.note /> Add note</CommandItem>
          {BLOCKS.map((b) => {
            const G = Icons[b];
            return <CommandItem key={b} value={`add ${b} block`} onSelect={run(() => addItem(b))}><G /> Add {b} block</CommandItem>;
          })}
        </CommandGroup>
        <CommandGroup heading="Insert snippet in code">
          {SNIPPETS.map((s) => {
            const G = Icons[s.icon];
            return (
              <CommandItem key={s.id} value={`snippet ${s.label} ${s.keyword}`} onSelect={run(() => (setCodeOpen(true), requestAnimationFrame(() => insert(s))))}>
                <G /> {s.label} <CommandShortcut className="font-mono tracking-normal">{snippetPreview(s)}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="View">
          <CommandItem onSelect={run(requestFit)}><MaximizeIcon /> Fit diagram <CommandShortcut>⌘0</CommandShortcut></CommandItem>
          <CommandItem onSelect={run(() => setCodeOpen(!codeOpen))}><PanelLeftIcon /> {codeOpen ? 'Hide' : 'Show'} code panel</CommandItem>
          <CommandItem onSelect={run(useStore.getState().undo)}><UndoIcon /> Undo <CommandShortcut>⌘Z</CommandShortcut></CommandItem>
          <CommandItem onSelect={run(useStore.getState().redo)}><RedoIcon /> Redo <CommandShortcut>⇧⌘Z</CommandShortcut></CommandItem>
          {APPEARANCES.map(({ value, label, Icon }) => (
            <CommandItem key={value} value={`appearance ${label}`} onSelect={run(() => useAppearance.getState().setAppearance(value))}><Icon /> Appearance: {label}</CommandItem>
          ))}
          <CommandItem onSelect={run(() => setHelp(true))}><HelpCircleIcon /> Help & shortcuts <CommandShortcut>?</CommandShortcut></CommandItem>
        </CommandGroup>
        <CommandGroup heading="Diagram theme">
          {THEME_GROUPS.flatMap((g) =>
            Object.entries(THEMES)
              .filter(([, t]) => t.group === g)
              .map(([id, t]) => (
                <CommandItem key={id} value={`theme ${t.name} ${id}`} onSelect={run(() => useStore.getState().setTheme(id))}>
                  <Swatch id={id} /> Theme: {t.name} <CommandShortcut className="font-mono tracking-normal">{id}</CommandShortcut>
                </CommandItem>
              )),
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
