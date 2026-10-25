# SeqDraw

An open-source, login-free sequence diagram editor. You write **Mermaid-compatible code**
and edit the diagram on a **draw.io-style canvas**, and each one updates the other.

- **No account, no server, no tracking.** Everything runs in your browser tab. Diagrams are never uploaded.
- **Save and resume:** *Save* writes a `.seqd` file to your computer. *Open* it (or drag it onto the window) to continue later.
- **Export:** PNG (1–4×, optional transparent background), SVG, vector PDF, `.mmd`, or a Markdown ```` ```mermaid ```` block.
- **Editable images:** PNG and SVG exports embed the diagram (like draw.io), so you can reopen them in SeqDraw and keep editing.

## Canvas editing

| Gesture | Result |
| --- | --- |
| Drag empty space / Space+drag / scroll | Pan |
| ⌘/Ctrl+scroll, pinch, `+` / `-` | Zoom (`⌘0` fits the diagram) |
| Hover a lifeline, then drag to another lifeline | New message (drop on the same lifeline for a self-message) |
| Drag a participant sideways | Reorder or re-space participants |
| Drag a message or note | Up or down reorders it, including into or out of `loop`/`alt`/… blocks; sideways moves it onto other lifelines |
| Drag a block's label (`loop`, `alt`, …) | Move the whole block with its contents |
| Drag the ● ends of a selected message | Reconnect the sender or receiver |
| Drag the □ corner of a selected participant | Resize |
| Double-click / Enter / F2 | Edit text inline (Shift+Enter adds a new line) |
| Drag from the shape palette | Add a participant, actor, database, message, note or block at that spot |
| Delete / Backspace | Delete (deleting a block keeps its contents) |

The properties panel changes arrow style, activation, note position, block type, and similar settings.

## Supported Mermaid syntax

`sequenceDiagram`, `title`, `autonumber`, `participant` / `actor` (with `as` aliases and
`@{ "type": "database" }`), all ten arrow types (`->`, `-->`, `->>`, `-->>`, `-x`, `--x`, `-)`, `--)`,
`<<->>`, `<<-->>`), `+`/`-` activation shorthand, `activate`/`deactivate`, notes (`left of`,
`right of`, `over A,B`), `loop`, `alt`/`else`, `opt`, `par`/`and`, `critical`/`option`, `break`,
`rect`, `%%` comments, and `<br/>` line breaks.

Canvas edits rewrite only the lines they touch, so your formatting and comments are kept.
Layout tweaks that Mermaid can't express (custom spacing and box sizes) are stored in the `.seqd` file, not in the code,
so the code stays valid Mermaid.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # parser / serializer / layout unit tests
npm run build      # static site in dist/ (host anywhere: GitHub Pages, Netlify, a USB stick)
```

### Architecture

```
src/core/      model, parser, serializer, editing ops, layout engine (pure TS, unit-tested)
src/render/    DiagramSvg: pure SVG renderer, shared by the canvas and every export
src/canvas/    pan/zoom/drag/connect/resize interaction + inline text editor
src/editor/    CodeMirror 6 with Mermaid highlighting, inline errors, selection sync
src/state/     zustand store (code + layout overrides + undo history) and UI actions
src/io/        .seqd project format, editable PNG/SVG embedding, PNG/SVG/PDF export
src/ui/        toolbar, palette, properties panel
```

The code is the single source of truth: `code → parse → layout → SVG`. Canvas gestures become
line edits that are serialized back to code.

## File format (`.seqd`)

```json
{ "app": "seqdraw", "version": 1, "savedAt": "…", "theme": "default",
  "code": "sequenceDiagram\n  A->>B: hi",
  "layout": { "participants": { "B": { "width": 160, "gap": 220 } } } }
```

## License

MIT
