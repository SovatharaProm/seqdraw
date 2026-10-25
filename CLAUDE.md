# SeqDraw — project notes for Claude

Open-source, login-free sequence-diagram editor in the spirit of draw.io: Mermaid sequence-diagram code on the left, an editable canvas on the right, kept in two-way sync. No AI credits, no accounts, **no user data on any server**.

## Hard constraints (from the user)

- **No backend, no login, no telemetry, no third-party requests.** It is a static site (`base: './'`). Fonts are bundled via `@fontsource` — never add Google Fonts/CDNs.
- Everything the user makes stays in their browser (localStorage draft) or in files they download.
- Mermaid compatibility: code written here must render the same in Mermaid, and Mermaid code pasted in must work here.
- UI style: minimalist, cool greys plus **one indigo accent** (`#4f46e5` light / `#818cf8` dark), meant to look better than mermaid.ai. Coloured code highlighting. Red only for errors. **No yellow/orange/amber** in the app UI. Exception: diagram notes are yellow, as the user asked. No "Local only" / "Valid sequence" status badges in the UI.
- Code comments: short labels only (`// Move participant`, `// Axis X: widths and spacing`). No long explanatory or JSDoc comments.
- Keep per-kind data in registries (e.g. `src/core/participants.ts`), not hard-coded lists spread across files.

## Stack

React 19 + TypeScript (strict) + Vite · CodeMirror 6 · Zustand · custom SVG renderer · jsPDF + svg2pdf.js (lazy-loaded) · vitest.

```
npm run dev        # vite dev server
npm run build      # tsc --noEmit && vite build  -> dist/
npm test           # vitest run (18 tests in src/core/core.test.ts)
npm run typecheck
```

Before reporting work done: `npm run typecheck && npm test && npm run build`. For UI changes, also check in a headless browser (puppeteer-core with the system Chrome; earlier scripts live in the session scratchpad, not the repo). Note: Puppeteer needs two clicks to fire a dblclick, and pointer capture means hit-testing should use `document.elementFromPoint`.

## Architecture

**The code is the source of truth.** Pipeline: `code → parseLines → analyze (Doc) → layoutDiagram → SVG`.
Each canvas gesture becomes a *line operation* on the parsed lines, which are then serialized back to code. The serializer keeps the raw text of untouched lines byte for byte. It only reformats and re-indents edited or new lines, using the block depth and the detected indent unit.

Layout overrides (participant width/height/gap set by dragging or resizing) are **not** written to the code. They live in the project file (`.seqd`) and the store.

### Files

| Path | Role |
| --- | --- |
| `src/core/participants.ts` | Participant shape registry (`PARTICIPANT_SHAPES`, `shapeOf`, `isParticipantKind`, `declarationOf`). Palette, Inspector, snippets, layout height and serializer read from it |
| `src/core/model.ts` | Statement union (participant, message, note, block, branch, end, activation, autonumber, title, comment, header, frontmatter), arrow tokens/`ARROW_SPECS`, `Line {raw\|null, indent, stmt}`, `Doc`, `DiagramConfig`, `LayoutOverrides` |
| `src/core/parser.ts` | `parseStatement`, `parseLines` (marks the leading `---…---` frontmatter), `readConfig` (frontmatter `config.theme`/`title`, `%%{init: {"theme": ...}}%%`), `analyze` (participants and errors with line numbers), `parse` |
| `src/core/serializer.ts` | `formatStatement`, `serialize`, `detectIndentUnit` |
| `src/core/ops.ts` | Pure line ops: `setStatement`, `insertStatements`, `removeLines`, `moveLine`, `findBlockEnd`, `reorderParticipants`, `addParticipant`, `renameParticipant` (renames the id everywhere, or falls back to an alias when the new name isn't a valid id), `setParticipantKind`, `deleteParticipant`, `unwrapBlock`, `messageStmt`/`noteStmt`/`blockStmts`, `setConfigTheme` |
| `src/core/layout.ts` | `layoutDiagram(doc, overrides, measure)`: participant positions, activations, frames, message/note slots, bounds. Also `dropLine` and `nearestParticipant` for drag targets |
| `src/core/measure.ts` | Text measurement through canvas `measureText`, `measureFor(font, weight, upperLabels)`, `<br/>` and entity handling |
| `src/core/themes.ts` | Diagram themes (see below) |
| `src/render/DiagramSvg.tsx` | SVG renderer. Elements carry `data-kind`/`data-line`/`data-id` for hit-testing. The export strips these |
| `src/canvas/Canvas.tsx` | Interaction layer (see Canvas features). Exports `requestFit` |
| `src/editor/CodeEditor.tsx` | CodeMirror: Mermaid StreamLanguage tokenizer (frontmatter aware), lint from parse errors, linked-line highlight for the canvas selection, autocomplete, 4-space `indentUnit`, `allowMultipleSelections`, ligatures off. Store↔editor sync uses minimal diffs. Exports `getEditorView` |
| `src/editor/snippets.ts` | `SNIPPETS` (Participants / Messages / Notes / Fragments / Other) with linked `${1:..}` fields filled with real participant names. `completeMermaid` suggests theme names after `theme:`, snippets at the start of a line, and participant ids elsewhere. `insertSnippet` |
| `src/editor/SnippetMenu.tsx` | Editor header (Code / Snippets tabs, Live switch, Run button when Live is off, Docs, hide) and the Snippets tab (filterable list with a code preview per row) |
| `src/state/store.ts` | Zustand: code, overrides, derived theme/doc/layout, selection, editing, fileName, dirty, undo/redo. `setTheme` writes into the code via `setConfigTheme`. `ProjectData` |
| `src/state/actions.ts` | Canvas → code actions: `editText`, `setText`, `deleteSelection`, `addItem`, `moveParticipant`, `resizeParticipant`, `moveStatement`, `connect`, `updateStatement`, `changeParticipantKind`, … |
| `src/state/draft.ts` | Reload safety: `restoreDraft`, `startDraftAutosave` (debounced, flushed on `pagehide`) |
| `src/io/project.ts` | `.seqd` JSON format, `fromProjectJson`, `embedInSvg`/`embedInPng`, `openFile` (accepts seqd/json/mmd/mermaid/md/txt/svg/png) |
| `src/io/export.ts` | `svgString`, `pngBlob` (scale, transparent, embed), `pdfBlob`, `projectBlob`, `download` |
| `src/ui/` | `Toolbar` (New from examples, Open, Save, Export, undo/redo, Appearance, help), `ThemeBadge` (theme menu, top-right of the canvas), `Menu`, `Palette`, `Inspector`, `icons`, `appearance.ts`, `fileActions.ts`, `toast.ts`, `examples.ts` |
| `src/App.tsx` | Layout (editor pane, splitter, canvas pane), help modal, global shortcuts, file drop onto the window, toasts |
| `src/main.tsx` | Font CSS imports, `initAppearance()`, `restoreDraft()`, `startDraftAutosave()` |
| `src/styles.css` | Design tokens (light block plus a dark block, which is duplicated under `prefers-color-scheme` and `[data-theme="dark"]`) |

## Implemented features

**Code ↔ diagram**
- Mermaid `sequenceDiagram` syntax:
  - participant, actor, and `@{ "type": ... }` shapes: database, boundary, control, entity, collections, queue, with aliases (`as`)
  - all arrow types (`->> -->> -> --> -x --x -) --)`) with `+`/`-` activation shorthand, plus `activate`/`deactivate`
  - `Note left of/right of/over A,B`
  - loop, alt/else, opt, par/and, critical/option, break, rect
  - `autonumber`, `title`, `%%` comments, `<br/>`
- Parse errors show as inline lint and in an error bar (shown only when there are errors).
- Selecting on the canvas highlights the matching code line, and vice versa.

**Canvas** (`Canvas.tsx`)
- Pan (drag the background or use the wheel), zoom (ctrl/pinch wheel), and Fit (accounts for the palette).
- Drag a participant to reorder it or change its spacing. Drag a message/note vertically to reorder it (into or out of blocks) and sideways to shift it onto other lifelines (`horizontalShift`). Drag a block's tab/label to move the whole block (`moveRange`). A ghost follows the cursor while the original fades.
- Resize handles on participants. Double-click resets the size.
- Connect: hover a lifeline dot and drag to another lifeline to create a message. Drag a message end to reconnect it.
- Double-click any text to edit it inline (textarea using the theme font).
- Palette: a horizontal dock at the bottom centre (grouped, tooltips). Click to add, or drag onto the canvas.
- Zoom: a horizontal pill at the bottom right (hand, zoom out, %, zoom in, fit). Fit leaves room for the theme badge and the dock.
- Layout bounds include message label widths, so self-message labels aren't clipped.
- Inspector panel shows the selection's properties: arrow type, participant kind, text, and so on.
- Keyboard: Delete, undo/redo, Escape, and more (see the help modal).

**Themes**
- The theme is read from the code: frontmatter `config: theme: <id>` or the `%%{init}%%` directive. The theme badge on the canvas writes it back into the code.
- `DEFAULT_THEME = 'redux'` (black and white) applies when the code sets none.
- Theme ids (same as Mermaid where they exist):
  - SeqDraw: `blueprint`, `blueprint-light`
  - Classic: `neutral`, `default`, `forest`, `base`, `dark`
  - Redux: `redux`, `redux-dark`, `redux-color`, `redux-dark-color` (the color variants give each participant its own palette color)
  - Neo: `neo`, `neo-dark`
- `LEGACY_THEMES` maps old `.seqd` theme ids.
- Theme fields include font, label weight and uppercase, grid, radius, stroke width, palette and dark, plus `lifelineDash` (unset = solid, like Mermaid; only Blueprint is dashed), `lineWidth`, `frameDash` and `gridStyle` (`dots` by default, `lines` for Blueprint).
- Redux themes match Mermaid's renderer: thin solid grey lifelines (`#8d8b96`), ink `#1e1a34`, dashed frames, normal-weight labels. `redux-color` uses the Tailwind 50/400 palette sampled from Mermaid (fuchsia, teal, orange, cyan, green, violet, rose, sky). Lifelines stay grey in the colour variants.
- Self-messages are drawn as a curve (`selfPath`), as in Mermaid.
- Notes have a folded top-right corner, a 1px border and extra padding (min width 120). Redux notes: `#fff8c5`/`#d9b93c`, dark `#2e2a17`/`#b39a35`.
- **Diagram fonts must be system fonts** so that exported/rasterized SVGs look identical. Only the app UI uses the bundled Space Grotesk and JetBrains Mono.
- The canvas has no white "page card". The diagram sits on the theme background with its grid.

**App appearance**
- Light, dark or system. Stored in `seqdraw.appearance` and applied as `data-theme` on `<html>` before render.
- Tokens: light `--accent/--primary #4f46e5` on `--panel #ffffff`; dark `#818cf8` on `#151722`.
- Code colours (`--code-*`): heading/keywords violet, names sky blue, arrows pink, config and `@{}` teal (`--code-meta`), comments slate italic.
- The Canvas sets `--accent` to indigo (lighter on dark diagrams) for the selection.

**Editor** (own look, not a mermaid.ai copy: flush side panel, underline tabs, mono status bar)
- Auto-Update (`seqdraw.autoUpdate`): when off, typing goes to `pending` in the store and the diagram waits for Update / ⌘↵. Every canvas action, save/export, undo/redo and closing the panel calls `flush()` first, so edits are never based on stale code. The draft saves `pending ?? code`.
- The close button hides the code panel (`seqdraw.code.open`). A Code button on the canvas reopens it.
- Indent guides every 4 spaces (`indentPlugin`).
- The hand tool in the zoom bar makes every drag pan (like holding Space).

**Snippets**
- Snippets tab: filter box, grouped rows (icon, name, one-line code preview). Clicking inserts at the cursor and switches back to Code.
- Status bar under the editor: participant/message counts, or `Syntax error Line N: …` in red. Lint tooltips also start with `Syntax error:`.
- The same snippets appear in autocomplete. Tab moves between linked fields.

**Files and persistence**
- Save: a `.seqd` file (JSON: `app, version, savedAt, theme, code, layout`).
  - Uses the File System Access API where available, so Save writes back to the same file. Otherwise it downloads.
- Open: a button, a file picker, or dropping a file anywhere on the window. Unsaved changes ask for confirmation first.
- Export:
  - SVG, PNG (1x/2x/…, optional transparent background), PDF, `.mmd`
  - copy code, a Markdown fence, or the SVG markup
- **Editable exports:** PNG and SVG can embed the project and be reopened later to keep editing.
  - PNG: a `tEXt` chunk with key `seqdraw` holding base64 JSON (CRC32 is computed).
  - SVG: `<metadata id="seqdraw-project">`.
- New: pick from the examples (Login flow, Prize redemption (redux-color), Basic, Loops & notes, Parallel, Blank). A new diagram keeps the current theme.
- Reload safety: the draft autosaves to `localStorage` under `seqdraw.draft.v1`.

## Gotchas learned the hard way

- `html, body, #root, .app, .editor-pane` use `overflow: clip`, and the grid uses `minmax(0,1fr)`. With `hidden`, CodeMirror's programmatic scroll shifted the whole page up.
- React renders `<rect></rect>`, not `<rect/>`. Don't strip SVG elements with regexes that expect self-closing tags. For a transparent PNG, don't render the background rect at all.
- Use a 4-space indent unit. Snippets with `\t` rely on it.
- JetBrains Mono ligatures turn `->>` into a glyph, so ligatures are disabled in the editor.
- Autocomplete must not suggest the half-typed word, which the live parse sees as a new participant.
- Initial Fit has to re-run on the next animation frame, after the palette is measured.

## Not done yet (ideas offered, not requested)

GitHub Pages deploy · share via URL hash · ESLint/Prettier/CI · an "Auto" diagram theme that follows the app mode · session-only draft storage · other sequence features (`box` groups, `create`/`destroy`, `links`). Git is initialized but nothing has been committed yet.
