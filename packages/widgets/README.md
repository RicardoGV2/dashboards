# Widgets

Implemented: a typed registry of defaults and a factory for note/text/shape objects. This is a starter registry, not the final third-party plugin contract. Schema validation lives in `document`, drawing in the renderer. Introduce independently versioned validators/render/export hooks with the first rich widget; isolate untrusted runtime code before accepting external plugins.
