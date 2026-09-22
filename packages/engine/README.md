# Engine

Implemented: pure camera math (`camera/index.ts`), atomic commands and bounded history (`history/index.ts`), culled DOM renderer adapter (`renderer/index.ts`). The input controller currently lives in `apps/web/main.ts`; extraction is planned before drawing or nested widgets. Geometry/spatial folders remain design placeholders. Math/history have no browser or framework dependency.
