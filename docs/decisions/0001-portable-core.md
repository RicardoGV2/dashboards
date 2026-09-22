# ADR 0001: own meaning and operations; replace views

Status: adopted for foundation, 2026-09-22.

The user prioritizes reliable logic and longevity over the temporary sample UI. We own the versioned document, validated operation semantics and camera math. A view is disposable: browser DOM now, Canvas/GPU/remote visual output when justified. Do not store runtime DOM, compiled shaders, provider responses or JavaScript functions as authoritative document state.

The initial model is intentionally limited to note/text/shape objects. Future datasets and semantic entities must be separate from views; this is a schema migration, not a claim that schema v1 already implements a knowledge graph.

Use a small TypeScript/Vite project with source modules. No React dependency until the shell needs it, no package-per-folder monorepo overhead, no native/GPU dependency. This revises the initial React proposal while preserving core portability. The renderer adapter contains DOM code; camera, document and history do not.

Costs: we maintain interaction logic; current snapshot history and DOM recreation are limited; the widget registry is a starter rather than an untrusted-plugin platform. Before scale work, profile and replace hot paths with patches/keyed updates/spatial indexing. Before external agents, implement runtime proposal validation, revision checks, idempotency and backend authorization.
