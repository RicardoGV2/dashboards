# Verification

`npm test` checks inverse transforms, zoom anchor invariance, atomic validation, import preservation and history. `npm run test:browser` runs real browser engines with desktop and emulated phone viewports: edits, save/reload, import/export, undo, drag cancellation, culling, keyboard movement and tab isolation. Build separately with `npm run build`. Emulation does not validate physical touchscreen or assistive-technology behavior; see plan.md for the release matrix.
