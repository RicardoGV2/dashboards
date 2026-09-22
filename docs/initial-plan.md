# Infinite Canvas Platform — Development Plan

> **Status:** Proposal for review. No engine implementation or migration has started.
> **Repository:** https://github.com/RicardoGV2/dashboards
> **Current demo:** The existing root `index.html`, `styles.css`, and `script.js` remain the active GitHub Pages site until an explicit migration decision.

## 1. Product vision

Build an extensible, browser-based infinite workspace where users can position, edit, connect, animate, and export many kinds of content on one continuous canvas: shapes and freehand drawing, charts, editable spreadsheets, text, code, flowcharts/Mermaid, photos, video, and future custom widgets. The canvas is a shared spatial environment rather than a fixed dashboard grid.

### Principles

- **Own the engine:** Implement camera, geometry, scene graph, interactions, rendering orchestration, document model, and plugin contracts in our code. No dependence on a third-party infinite-canvas SDK.
- **Use specialist components:** It is acceptable to integrate charting, code editing, media playback, formula calculation, and Mermaid as encapsulated widgets. We do not need to recreate browser capabilities or every editor from scratch.
- **Separate concerns:** A framework-independent TypeScript engine, an independent document model, pluggable widgets, and a React web shell.
- **Precise, not literally limitless:** Use world-space coordinates, zoom transforms, and device-pixel-ratio-aware rendering. A large canvas is constrained by floating-point precision, GPU memory, DOM and browser limits; address those deliberately.
- **Progressive complexity:** Start offline-first with local persistence and explicit import/export. Add accounts, server storage, and collaboration only when needed.
- **Protect user work:** Version documents, validate imported data, provide undo/redo, and test migrations before changing formats.

## 2. Hosting and deployment decision

**Keep GitHub for source control.** Keep the existing demo on GitHub Pages while reviewing this plan. GitHub Pages is appropriate for an initial, static client-side editor; it does not run our own persistent application backend. A later hosted frontend can remain in this same GitHub repository and use a separate API, database, and asset store. Reassess hosting when the app needs multi-device sync, authentication, uploaded media, shared workspaces, or server computations. Do not store user documents or access tokens in the repository or client bundle.

**Deployment guardrail:** Do not change the root `index.html`, `styles.css`, `script.js`, Pages source, or deployment settings during the planning/scaffolding step. A future migration to Vite must account for the project-site base path `/dashboards/`, and switch deployment only after a verified production build and explicit approval.

## 3. Proposed repository layout

```text
dashboards/
├── index.html                 # Existing live demo — retained for now
├── styles.css                 # Existing live demo — retained for now
├── script.js                  # Existing live demo — retained for now
├── README.md                  # Existing demo readme — retained for now
├── plan.md                    # This proposal
├── apps/
│   └── web/                   # Future React + TypeScript + Vite application
├── packages/
│   ├── engine/                # Framework-independent canvas engine
│   │   ├── camera/            # World/screen transforms, pan/zoom
│   │   ├── geometry/          # Bounds, matrices, hit testing
│   │   ├── renderer/          # Scene traversal, Canvas 2D and DOM integration
│   │   ├── interactions/      # Pointer, keyboard, touch, tool state
│   │   ├── spatial/           # Visibility queries, spatial indexing
│   │   └── history/           # Commands, transactions, undo/redo
│   ├── document/              # Versioned objects, relations, assets, serialization
│   ├── widgets/               # Registry, widget contracts and implementations
│   └── ui/                    # Shared React interface components
├── tests/                     # Unit, integration, regression and browser tests
└── .github/
    └── workflows/             # CI and, later, approved deployment workflows
```

For now these directories contain documentation placeholders, **not a configured runnable monorepo**. Do not run `npm install` at the repository root expecting a package manifest until Phase 0 is approved and implemented.

## 4. Engine design

### 4.1 Camera and geometry

- World coordinates are independent from screen CSS pixels and device pixels. Model `screen = (world - camera) * zoom`, with a tested inverse.
- Zoom around the cursor; support mouse wheel, trackpad, keyboard, and touch gestures, with configurable limits.
- Maintain explicit matrix transforms for translation, scale, rotation, parenting and nested objects.
- Implement deterministic bounding-box calculations, rotated hit testing, snapping and alignment guides.
- Investigate origin rebasing or chunked coordinates if very large world positions cause observable precision loss.

### 4.2 Document and scene graph

- Stable IDs; typed/versioned nodes; transforms; stacking order; visibility; locking; groups; parent-child ownership.
- Explicit connector edges and references rather than relying on array order or ad hoc widget IDs.
- Separate document data from runtime objects and DOM nodes; support schema validation and migrations.
- Track asset metadata and references separately from large binary payloads.
- Include a transaction/command layer to enable undo/redo, reproducible tests and eventual collaboration.

### 4.3 Rendering and interaction

- Start with a hybrid scene: Canvas 2D for the background and simple shapes, positioned DOM/React portals for genuinely interactive widgets, and a synchronized overlay for selection and tools.
- Keep one authoritative camera and coordinate transform across canvas, overlays and widgets.
- Define event ownership: pointer capture, editor focus, drag versus pan, nested scroll, keyboard shortcuts, touch and accessibility.
- Add viewport culling and image/media lifecycle handling before using very large documents.
- Profile before adopting OffscreenCanvas, WebGL, WebGPU or worker-based rendering. Provide feature detection and fallbacks.

### 4.4 Widget architecture

Every widget type should declare a versioned type ID, schema/validation, default creation, editing/inspection UI, renderer, serialize/deserialize, migration and export hooks. The engine must not know the internal data schema of individual widgets. A chart, spreadsheet, video or Mermaid diagram should be movable and resizable using the same core primitives, but edit its own content in a focused mode. Avoid nesting a second pan-and-zoom engine inside the main canvas.

### 4.5 Pixel-management scope

Distinguish (1) world-unit positioning, (2) pixel-precise layout and exported dimensions, and (3) raster pixel editing. Start with the first two; introduce a dedicated raster widget/editor with image buffers, brushes, masks and compositing in a later phase. Specify CSS-pixel versus physical-pixel semantics and device pixel ratio for screenshots/exports.

## 5. Phased milestones and acceptance criteria

### Phase 0 — Foundation and decisions

**Deliver:** Adopt package manager/workspace tooling; establish TypeScript strict mode, formatter/linter, unit tests and browser smoke tests; choose a document-schema strategy; define accessibility baseline and license/dependency policy; prototype camera math; establish GitHub Actions build checks without changing existing Pages deployment.

**Exit criteria:** New workspace builds and tests locally and in CI; a documented design decision records the engine/renderer boundary; existing sample page is still deployable. Review and approve Phase 0 before starting it.

### Phase 1 — Working infinite canvas

**Deliver:** World-space camera, cursor-centered zoom, pan, background grid, create/select/move/resize simple objects, shared keyboard/pointer handling and a minimal inspector.

**Exit criteria:** Zooming preserves the world point below the cursor; inverse-transform tests pass; objects keep world positions across viewport changes; basic mouse, trackpad and touch navigation works; no noticeable interaction regressions on a representative desktop scene.

### Phase 2 — Editor and durable documents

**Deliver:** Multi-select, grouping, alignment, snap guides, layers, locking, undo/redo, IndexedDB autosave with recovery states, JSON import/export and schema migrations.

**Exit criteria:** Refresh restores a saved document; import/export round trips without silent loss; undo/redo works for moves, resizes and creates; corrupt or incompatible documents produce actionable errors and do not overwrite existing work.

### Phase 3 — Widget system

**Deliver:** Widget registry/contract, text, image, charts, Mermaid, code blocks and a first editable table. Separate external datasets and widget bindings from spatial node state.

**Exit criteria:** A new widget can be added without edits to camera code; every shipped widget can be selected, moved, resized, saved and restored; edit mode does not accidentally pan/drag the canvas; assets and inputs are sanitized appropriately.

### Phase 4 — Media, precision and scale

**Deliver:** Video lifecycle and poster frames, animation timeline, optional raster pixel editor, large-image handling, viewport culling, spatial index, object batching and performance profiling.

**Exit criteria:** Off-screen media does not consume avoidable resources; high-DPI rendering and exports have defined dimensions; large-scene benchmarks and memory measurements are recorded; any GPU optimization has a tested fallback.

### Phase 5 — Cloud and collaboration (only if needed)

**Deliver:** Authentication, ownership/permissions, backend API, database, object storage, sync protocol and eventually CRDT/operational collaboration where justified.

**Exit criteria:** Users can safely recover documents across devices; authorization is checked on the server; concurrent edits and conflict recovery are tested; secrets remain on the server; hosting meets actual usage requirements.

## 6. Nonfunctional requirements

- **Accessibility:** Keyboard navigation, labels, focus management, reasonable alternatives for visually edited content and reduced-motion support.
- **Performance:** Target smooth 60 FPS interaction on a defined reference device/scene; measure frame time, DOM count, memory, file size and asset decoding instead of promising unlimited scale.
- **Security:** Treat imported files and widget content as untrusted; sanitize HTML/SVG/Mermaid output, restrict iframe/embed origins, avoid arbitrary execution of user-authored code in the main origin, and enforce server-side permissions when backend features arrive.
- **Privacy:** Prefer local-only work by default initially; make uploads and sharing explicit.
- **Compatibility:** Test current major browsers, high-DPI screens and touch inputs; gracefully degrade optional graphics acceleration.
- **Testing:** Unit-test coordinate math and history; integration-test storage/migrations/widgets; browser-test input behavior and production-build navigation. Include visual regression snapshots for precision-sensitive changes.

## 7. Initial technical choices (proposals, not commitments)

| Area | Starting point | Reason / decision trigger |
| --- | --- | --- |
| Core | TypeScript (no React dependency) | Portable, testable engine logic. |
| Web shell | React + Vite | UI components and static build for Pages. |
| Rendering | Canvas 2D + DOM overlay | Editable HTML widgets and owned shape renderer. |
| Storage | IndexedDB + explicit JSON export | Offline-first, no backend for initial releases. |
| Geometry/spatial | Small in-house math layer; add spatial index when measured | Avoid premature heavyweight dependencies. |
| Charts / code / diagrams | Independent widget adapters | Reuse focused libraries while retaining engine ownership. |
| CI | GitHub Actions for lint, test and build | Do not alter Pages settings until migration is approved. |
| Backend | Undecided | Choose only when product requirements justify it. |

## 8. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Building an editor engine takes substantial effort | Ship testable milestones; keep the first renderer and object set small. |
| Divergent Canvas/DOM coordinates | Centralize matrices and test transforms end to end. |
| Browser/GPU limits with very large documents | Culling, asset LOD, profiling and documented practical limits. |
| Document corruption or incompatible versions | Version schemas, validate, migrate, and preserve recovery/export paths. |
| Widget input conflicts | Explicit tool state and event ownership; editor-focus tests. |
| Unsafe rich content or user code | Sanitize, sandbox and set restrictive embed policies. |
| Premature backend/hosting costs | Local-first MVP; defer services until required. |
| Breaking the current demo | Preserve root files and Pages source until approved migration. |

## 9. Decisions to review before implementation

1. Is the primary workflow an open-ended whiteboard, a dashboard/dataflow builder, or both equally?
2. Is single-user, local-first the right first release, or is cross-device sync essential immediately?
3. Which two or three widgets must ship first after shapes (e.g., chart, text and table)?
4. Should raster pixel editing be a full editor or an image-annotation feature initially?
5. Which browsers/devices and file sizes should establish initial performance targets?
6. Are third-party specialist libraries acceptable if the canvas engine itself is fully ours?
7. After confirming the current Pages demo works, should we create the Phase 0 development branch and keep deployment on `main` until the new app is ready?

**Next action:** Review this plan and confirm the current sample page is accessible. Do not start engine implementation or migrate hosting until the plan has been reviewed.
