# Document model

Schema v1 validates note/text/shape nodes, stable IDs, bounded geometry and safe strings/colors. `validateDocument` clones validated input; `parseDocument` adds a 5 MB UTF-8 cap. Unknown fields/types and future versions are rejected to avoid silent loss. Semantic entities, datasets, relationships, binary assets and migrations remain roadmap work.
