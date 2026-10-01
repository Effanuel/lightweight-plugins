import { defineConfig } from 'tsup';

// ponytail: single bundled entry; a consumer importing one plugin still keeps a few hundred
// bytes of other plugins' defaultOptions literals. Split into per-plugin entries if that matters.
export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	sourcemap: true,
	clean: true,
});
