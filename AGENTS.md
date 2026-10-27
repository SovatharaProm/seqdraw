# Repository Guidelines

## Project Structure & Module Organization

SeqDraw is a client-only React and TypeScript editor for Mermaid-compatible sequence diagrams and flowcharts, built with Vite.

- `src/core/`: sequence diagram models, parsing, serialization, editing operations, and layout.
- `src/flow/`: equivalent flowchart logic, shapes, and ELK layout integration.
- `src/render/`: SVG renderers shared by the canvas and exports.
- `src/canvas/`, `src/editor/`, `src/ui/`: canvas interactions, CodeMirror editor, and interface components.
- `src/state/`: Zustand stores, undo history, and editing actions.
- `src/io/`: `.seqd` project files and PNG, SVG, PDF, and Mermaid exports.
- `src/hooks/` and `src/lib/`: reusable hooks and browser utilities. Static assets live in `public/`; shared styles are in `src/styles.css`.

Keep diagram code as the source of truth: `code → parse → layout → SVG`. Canvas edits should serialize changes back into code while preserving untouched formatting and comments.

## Build, Test, and Development Commands

Use Node.js 24 or newer. The README uses npm:

- `npm install`: install dependencies.
- `npm run dev`: start the local Vite server, normally at `http://localhost:5173`.
- `npm run typecheck`: check strict TypeScript types without emitting files.
- `npm test`: run the Vitest suite once.
- `npm run build`: type-check and generate the static site in `dist/`.
- `npm run preview`: serve the production build locally.

## Coding Style & Naming Conventions

Follow existing TypeScript conventions: two-space indentation, single-quoted strings, and semicolons. Use PascalCase for React components and their filenames, camelCase for functions and variables, and `use` prefixes for hooks. Keep pure diagram logic separate from browser interactions. TypeScript enables strict checking and rejects unused locals and parameters. No dedicated formatter or lint script is configured.

## Testing Guidelines

Vitest runs in a Node environment. Tests are colocated as `src/core/core.test.ts` and `src/flow/flow.test.ts`, using `describe`, `it`, and `expect`. Add regression cases for parser, serializer, editing, and layout changes; preserve round-trip behavior. No coverage threshold is configured. Run tests and the production build before submitting; manually check affected canvas or editor interactions for UI changes.

## Commit & Pull Request Guidelines

History includes descriptive summaries and `feat:` prefixes, without a consistent enforced convention. Write short, imperative summaries; use `feat:` or `fix:` when helpful. Pull requests should explain the behavior changed, link relevant issues, and report validation commands. Include screenshots or recordings for visible UI changes.

## Privacy & Configuration

Preserve the browser-only design: diagram contents stay local. Avoid introducing uploads, tracking, or server dependencies without an explicit project decision.
