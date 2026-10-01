// Smoke check for the built package. Run `pnpm build` first, then `pnpm test`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const EXPECTED = ['DEFAULT_BOX_STYLE', 'DEFAULT_DRAWING_STYLE', 'DEFAULT_FIB_LEVELS', 'DrawingManager'];

// Imports in plain Node with no DOM, as SSR and test runners do.
const mod = await import('../dist/index.js');
assert.deepEqual(Object.keys(mod).sort(), [...EXPECTED].sort(), 'runtime exports');
for (const name of EXPECTED) assert.notEqual(mod[name], undefined, name);

// lightweight-charts must stay external, or consumers get a second copy of the library.
const bundle = readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8');
assert.doesNotMatch(bundle, /Lightweight Charts™/, 'does not bundle lightweight-charts');

console.log(`smoke ok: ${EXPECTED.length} exports, lightweight-charts external`);
