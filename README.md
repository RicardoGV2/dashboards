# Field · Infinite Dashboard

A browser-based spatial workspace with a portable document model and an owned canvas engine. See [plan.md](plan.md) for the architecture review, technology direction and phased roadmap.

## Run the new editor

Node 22.6+ (CI uses Node 24):

```sh
npm ci
npm run dev
```

Open the local Vite URL. The new editor lives in `apps/web` and does not use the original sample dashboard.

```sh
npm test              # model, transaction and camera invariants
npm run build         # strict typecheck + /dashboards/ production assets
npx playwright install chromium webkit
npm run test:browser  # desktop, WebKit and phone-viewport tests
```

Build output: `apps/web/dist`. GitHub Pages serves the production `index.html` and `assets/` checked into the repository root. Run `npm run build:pages` and commit the generated files alongside source changes before publishing. The previous sample is available in Git history; the new editor does not reuse it.

## Working now

- Pan, anchored zoom, touch pinch, fit view, viewport culling.
- Create/select/move/resize notes, text, shapes, uploaded images, animated 3D cubes and reusable finance visual nodes; edit via properties and accessible object list.
- Atomic validated commands, undo/redo, IndexedDB autosave and JSON import/export.
- Confirm-before-place workflow: new notes, text, shapes, cubes, images and Finance maps appear as movable previews first; click or drag-and-release to commit, Esc cancels, and the committed insertion is one undo transaction.
- PNG, JPEG, WebP and GIF image uploads (2 MB each) stored as document assets and exported with the workspace.
- Animated cube widget with speed, direction, axis, color, perspective and pause controls.
- Finance visual map demo with reusable person modules, bank-city cards, animated incoming/outgoing money flows, expand/collapse and a finance inspector. Demo data only; no real bank connection yet.
- The dark/navy visual theme is global from first load; Finance adds finance-specific flows and overlays but no longer controls the application theme.
- Single-writer tab protection, import bounds and visible storage failures.

Drag empty space or use Pan. Scroll pans; Ctrl/⌘ + scroll zooms. Select canvas then V/H switches tools; N adds a note; arrow keys move a selected object (Shift = 10 units), or pan if none is selected. Ctrl/⌘ Z undoes; Shift adds redo. Escape cancels a drag. Properties offer keyboard-accessible size/position editing.

## Honest limits

This is a foundation, not the completed dashboard. Charts, spreadsheet formulas, drawing, video, groups, AI integrations, collaboration, GPU rendering, a full animation timeline and full plugin execution remain roadmap work. Device emulation is not physical-device certification. The canvas has numerical bounds; storage is browser-local, not a backup or device sync. Export important work. No offline reload guarantee yet. Browsers without Web Locks require manual export; other open tabs cannot autosave while one tab owns the workspace.

Schema v3 adds generic visual connections; schema v1/v2 documents migrate forward. Unsupported future document versions/types are rejected without replacing current work. The previous autosave is retained internally, but recovery UI and schema migrations remain milestone B.

Architecture: `packages/document`, `packages/engine`, `packages/widgets`, `packages/storage`, `apps/web`. No AI provider keys or services are required. See [ADR 0001](docs/decisions/0001-portable-core.md).


## Handoff

For the current architecture, additive-feature rule, finance visualization design, testing checklist and next-step guidance, see [docs/handoff-2026-09-22.md](docs/handoff-2026-09-22.md).
