# Renderer

`index.ts` implements the first DOM renderer with viewport culling. It uses a shared camera, places nodes relative to camera origin and writes user text through textContent. Current rendering rebuilds visible nodes on each frame and scans all nodes; keyed updates and spatial indexing are future scale work. Canvas2D/GPU adapters are not implemented.
