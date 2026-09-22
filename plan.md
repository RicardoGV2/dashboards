# Infinite Dashboard — a durable spatial workspace

Revision: 2026-09-22. This supersedes [the initial proposal](docs/initial-plan.md).

## Direction

Build a workspace where people and software agents arrange, edit and connect typed content on a continuous plane. The enduring asset is the user's **meaningful document**: data, relationships, computations, spatial intent and history. Visuals are projections of that document. The product must remain useful without an AI provider, GPU acceleration or a network connection after loading.

Own the document format, operation semantics, coordinate mathematics and extension interfaces. Use specialist libraries for spreadsheet calculation, charting, code editing and media when justified. “Our own engine” does not mean recreating browsers, video codecs or every numerical algorithm.

No implementation can guarantee compatibility with unknown hardware or every device. We can define portable contracts, export data, support a measured device matrix and keep optional technologies replaceable. Native apps can also last; web is our first distribution surface because it is easy to access and update. Portability comes from the core and open format, not merely the choice of web.

## Review of the original plan and structure

The repository at `5c8a688` contained a sample page and README-only directories; there was no runnable canvas, package manifest, test suite, engine, persistence or widget implementation. The original plan made sound choices about world coordinates, a framework-independent core, local storage and owning the engine.

Changes needed:

| Gap | Consequence | Revised decision |
| --- | --- | --- |
| Scene graph and data model treated together | UI choices can trap meaningful data inside pixels or widget code | Separate semantic entities/dataflow from spatial views as rich widgets arrive |
| Transactions vague, introduced late | AI and UI can mutate state inconsistently; undo becomes fragile | All committed edits pass validation through atomic commands from the first slice |
| “Every device” lacked a support definition | Unverifiable promise | Capability tiers and an explicit release matrix |
| Persistence deferred until after gestures | Early work can be lost | Autosave and export in the first slice; recovery and migrations before beta |
| Widgets listed without trust boundaries | Arbitrary generated code could run with application authority | Trusted bundled widgets first; isolated third-party runtime later |
| AI was absent from execution model | Retrofitting permissions, previews and provenance later is expensive | Design proposal/validation/commit protocol now; implement backend later |
| Performance specified as vague smoothness | No meaningful scale claim | Reproducible reference workloads, p95 latency and resource budgets |
| Too many empty packages and early framework commitment | Maintenance before proven interfaces | Small typed modules, no artificial publishable workspace packages yet |
| No computation graph or precision policy | Tables/charts could show inconsistent or hallucinated results | Typed data bindings and deterministic formula evaluation before AI-driven dashboards |

## Architecture and dependency rules

```text
People / AI adapters / importers
             |
     proposed commands
             |
 validation + authorization + revision preconditions
             |
 atomic document commit + undo / journal
             |
 semantic entities + dataflow + assets + spatial views
             |
 scene projection and viewport visibility
             |
 DOM / Canvas 2D / optional GPU / optional remote stream
```

This is the target architecture; the current implementation is intentionally smaller. The current schema contains five spatial object types (note, text, shape, image and animated cube) and no semantic graph or AI adapter yet.

- `packages/document`: serializable data, versions, validation. No DOM, React, storage, network or provider imports.
- `packages/engine`: camera/geometry, commands/history, visibility and renderer adapters. Math/history must remain usable in Node or a worker. Browser renderer code lives behind the adapter boundary.
- `packages/widgets`: type definitions and trusted adapters. The first registry supplies note/text/shape defaults. It is **not yet** the full plugin protocol.
- `packages/storage`: browser IndexedDB adapter, replaceable later by file or server adapters.
- `apps/web`: composition, UI, browser inputs and lifecycle. Current lightweight TypeScript shell; React is optional if shell complexity justifies it.
- `packages/ui`: reserved documentation only. Do not introduce a UI library until reuse exists.
- Planned `packages/dataflow`, `packages/assets`, `packages/agent-protocol` and `services/gateway`: create when their first feature ships; do not scaffold empty frameworks.

The existing camera/geometry/interactions/spatial/history layout remains useful, but empty modules are explicitly marked planned. As gesture complexity grows, extract and test the pointer state machine from `apps/web/main.ts` before adding drawing or nested editing.

## What must survive renderer and AI changes

1. Stable IDs and portable, versioned JSON with independently stored binary assets.
2. Semantic values, units, formulas, connections and source provenance. Never treat generated pixels as the authoritative numeric data.
3. Explicit operations: create, update, delete; later group, connect, bind, compute. Commands produce deterministic validated state for a given input. Random IDs and timestamps are supplied at the boundary.
4. Independent spatial views: a dataset can have a table view, a chart view and a generated visual without duplicating its underlying truth.
5. Human-readable exports and defined migrations. Future versions are rejected safely until supported; unknown data must never be silently removed.
6. Capability discovery: optional features advertise what they support. Adapter failure must preserve the document and enable a simpler view/export.

For an AI-generated image or streamed interface, keep a semantic sidecar: object IDs, accessible labels, hit regions, data references and allowed actions. A flat frame alone cannot reliably support exact editing, accessibility or formula auditing. Sidecars are an interface proposal, not an existing NVIDIA or xAI standard.

## Current media and motion slice

Images and a controllable animated cube are the first rich-media widgets. Images are represented as canvas nodes that reference document-level assets rather than embedding pixel data directly into the node. The current local prototype stores the image asset as a validated base64 data URL inside the exported workspace JSON so import/export remains a single-file workflow; this is intentionally an intermediate format. The later `packages/assets` milestone should move binary payloads to hashed asset records/object storage while preserving stable asset IDs in the document.

Supported image upload types are PNG, JPEG, WebP and GIF, currently capped at 2 MB each. SVG is deliberately excluded from this first upload path because active SVG content needs a separate sanitization and trust policy. Image nodes share move, resize, selection, undo/redo, autosave and export behavior with other objects. Deleting an image also removes its asset when nothing else references it.

The cube is a first motion/3D object implemented with CSS 3D transforms behind the same renderer adapter. Its document state stores speed, direction, axis, pause state and perspective; color uses the common node color. Playback time is runtime state and does not rewrite the document every frame. This is a deliberate precursor to the later animation timeline: future motion widgets should evaluate stable document parameters against an explicit time source rather than recording every frame as edits. Reduced-motion preferences pause cube playback visually.

The project/file workspace concept remains a capability of the broader canvas, not the canvas's primary identity. Future file trees, editable code, spreadsheet-like documents, media and project bundles should be added through typed widgets/assets while keeping the infinite spatial document general-purpose.

## Mathematics: durable foundation, not a secret by itself

- Distinguish world units, viewport CSS pixels and device pixels. Current camera: `screen = (world - cameraOrigin) × zoom`; inverse: `world = screen / zoom + cameraOrigin`.
- Cursor/pinch anchor invariant: the world point under the zoom anchor remains fixed, except when explicit world safety bounds clamp movement.
- Commit object transforms in world space. Floating DOM positions are disposable projections.
- Current release supports node origins in ±1,000,000 world units, 0.1–4× zoom and sizes 80–4,000 × 60–4,000 units. “Infinite” describes navigation, not unbounded numeric precision.
- Before rotation/groups: implement invertible affine matrices, composition order, local/world transforms and degeneracy checks. Test inverse and parent-child invariants.
- Before truly huge distances: introduce chunk coordinates plus local offsets, origin rebasing and version migration. Never just expand floating-point bounds without error measurements.
- Before dense scenes: use measured spatial indexing, screen-error-based level of detail, deterministic hit-testing and stable ordering.
- Before charts/tables: typed dependency DAG, cycle detection, incremental recomputation, units and precision rules. Money requires explicit decimal semantics, not arbitrary binary float rounding. Formula execution must not use JavaScript `eval`.
- Before animation: explicit document time and pure evaluation at time `t`; runtime playback clocks must not rewrite the document every frame.

The likely differentiation is how well spatial reasoning, reusable data relationships, precise editing and AI-assisted transformations work together. Common math algorithms alone are unlikely to be a moat.

## Technology direction: evidence vs bets

Research checked 2026-09-22; links in [technology notes](docs/technology-notes.md).

| Technology | What it changes | What we do |
| --- | --- | --- |
| NVIDIA neural rendering / generated pixels | How visuals are synthesized, with specific runtime/hardware integrations | Keep visual output replaceable; do not make dashboard correctness depend on it |
| AI agents and structured tool calls | Who proposes edits and computation | Typed, bounded proposals using the same command path as human input |
| Claimed xAI binary/0–1 programming direction | Exact claim not verified in official material | No speculative binary format or provider dependency; accept future adapters through stable contracts |
| WebGPU | Optional graphics/compute acceleration | Feature-detect adapter/limits, handle device loss, keep a baseline renderer |
| WebAssembly / workers | Potential portable compute and responsiveness | Add only for measured bottlenecks behind message-based interfaces |
| Remote streamed/generated views | Possible low-power-device display route | Optional backend adapter; retains semantic navigation and export, accounts for latency/privacy/cost |
| WebXR / spatial devices | Another input/view environment | Later experiment using shared semantic data; no promise of zero-cost portability |

AI may become much more involved in software and rendering, but this is a scenario to support rather than a certain replacement schedule for conventional applications.

## AI command protocol (design, not implemented)

Use a proposal envelope with `protocolVersion`, `proposalId`, `documentId`, `baseRevision`, `actor`, `capabilities`, `commands`, and provenance. Validate size, types, referenced IDs, data access, compute budgets and revision before preview. Human confirmation policy depends on effect: local reversible edits may be allowed; external uploads, paid jobs, arbitrary execution or publishing need their own authority.

Preview is side-effect free. Commit is atomic and idempotent by proposal ID. Stale proposals return a conflict rather than overwriting intervening work. Record accepted operations and their sources; undo a proposal as one transaction. Never put provider credentials into the static frontend. Backend gateway owns secrets, provider selection, quotas and authorization. An agent is not a security boundary and its output is always untrusted.

The current `Command` TypeScript union is a local building block only. It is not a network authorization layer or a production agent protocol.

## Device and accessibility contract

Baseline: modern desktop Chrome/Edge, Firefox and Safari; iOS Safari and Android Chrome. Support keyboard, mouse, trackpad and Pointer Events touch/pen through common interactions. No GPU requirement. Touch has two-finger pan/zoom, object dragging and a visible pan tool. Single-finger drag on empty space pans. Trackpad scroll pans; Ctrl/⌘ wheel zooms. Browser page zoom remains available through browser controls outside the canvas gestures.

Keep a semantic object list and form-based editing so the spatial view is not the only route to content. Provide visible focus, keyboard movement, explicit zoom/fit controls, reduced motion and labels. Before beta: screen-reader verification, touch target audit, focus restoration, mobile virtual keyboard tests and a list-focused editing mode for small screens.

Automated browser engines and emulated phones are useful checks, not physical-device certification. Test real iPhone/iPad Safari, Android Chrome with modest memory, a desktop keyboard/screen reader and a high-DPI desktop before claiming broad support.

## Persistence, safety and performance

First slice: IndexedDB saves acknowledged on transaction completion, serialized writes, a previous snapshot retained, visible failure state, manual JSON export, import validation, single writer tab using Web Locks. A second tab can edit/export but cannot autosave. Browsers without Web Locks use manual export. On corrupt saved content, stop autosave so recovery data is not overwritten.

Limitations to resolve before beta: recovery UI, multi-document catalog, tested schema migrations, durable incremental journal, pending-write close warning, conflict handling across devices and clearer save/export onboarding. Browser storage may be evicted; it is not a backup. Initial application loading requires connectivity; offline reload needs a later cache/service worker policy.

Current safety caps: 2,000 objects, 100 image assets, 12 MB imported UTF-8 JSON, 2 MB per uploaded image, 20,000 characters/object and 50 undo snapshots with an approximate 10-million-character history budget. These are guardrails, not performance promises. Undo storage and JSON serialization are still proportional to document size. There is viewport culling but a linear scan and DOM rebuilding; fix after profiling before claiming dense-scene support.

Performance gates to measure (targets, not achieved claims): desktop 1,000 simple nodes with ≤150 visible, p95 pan/zoom frame time <16.7 ms; midrange mobile 300 nodes with ≤50 visible, p95 <33 ms; input feedback p95 <100 ms. Record browser/device, workload, viewport, zoom, memory and test duration. Never compare arbitrary benchmark totals without visible-node counts and widget complexity.

## Milestones with concrete exit criteria

| Milestone | Deliverables | Exit gate |
| --- | --- | --- |
| A — Working foundation (this branch) | Strict TS, portable camera/model/commands, DOM view, note/text/shape, move/resize, undo/redo, object list, touch gestures, IndexedDB, import/export, CI | Unit invariants, browser save/restore/input tests, production build at `/dashboards/`; known limits documented |
| B — Reliability beta | Extract input state machine, recovery UI, migration fixtures, multi-document support, save lifecycle, keyboard/focus polish, real device matrix | No silent overwrite on corrupt/future files; recover from quota/abort/reload; accessibility and physical-device checks |
| C — Useful data dashboard | Dataset entities, bindings, typed computations, chart and editable table, text/code/Mermaid adapters | Same dataset updates table and chart; cycle/errors surfaced; no eval; saved/imported bindings remain intact |
| D — AI co-editor | Proposal schema, diff preview, revision/idempotency checks, backend provider adapter and authority boundaries | Same results through human and agent commands; bad/stale proposals cannot partially mutate state; no browser secrets |
| E — Media and performance | Evolve the initial embedded image assets and cube motion into hashed asset storage, video lifecycle, drawing, timeline animation, LOD/spatial indexing; optional Canvas2D/GPU adapters | Measured workloads meet target budgets; visible fallbacks; media pause/cleanup; exact export dimensions |
| F — Shared workspaces | Auth, server permissions, object storage, sync, conflict handling and possibly CRDT | Revocation works server-side; offline concurrent edits converge under a documented conflict policy; recovery tests |

Do not begin a full spreadsheet, raster editor, collaborative protocol and new GPU renderer simultaneously. Complete one useful vertical workflow per milestone. Proposed first workflow after foundation: paste tabular data → edit table → linked chart → ask AI for a reversible rearrangement or transformation.

## Hosting and review

GitHub Pages can host the static editor. Backend services are separate when introduced. Keep GitHub as source control. Build output is `apps/web/dist` with base `/dashboards/`; CI validates the application. The user authorized publishing the foundation on main on 2026-09-22. Run `npm run build:pages` to refresh the production root index.html and assets/ used by the existing Pages deployment. Commit generated output alongside source changes. Original sample code is not reused by the editor; it remains available in Git history. This is a foundation release, not a completed universal dashboard.

Assumptions: single-user local-first initially, trusted bundled widgets, precise data semantics before generative styling. These are reversible product choices. No additional approval is required for the foundation work requested in this conversation.
