import { copyFile, cp, writeFile } from 'node:fs/promises';
// Keep build artifacts in the existing root publishing location for GitHub Pages.
// Do not remove previous hashed assets: cached HTML may still reference them.
await copyFile('apps/web/dist/index.html', 'index.html');
await cp('apps/web/dist/assets', 'assets', { recursive: true });
await writeFile('.nojekyll', '');
console.log('Prepared root index.html and assets/ for GitHub Pages. Commit them with the source changes.');
