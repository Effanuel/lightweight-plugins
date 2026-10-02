import { defineConfig } from 'tsup';

// ponytail: single bundled entry; a consumer importing one plugin still keeps a few hundred
// bytes of other plugins' defaultOptions literals. Split into per-plugin entries if that matters.
// `react` is the optional settings toolbar; React stays external as a peer dependency.
export default defineConfig({
	entry: { index: 'src/index.ts', react: 'src/react/index.ts' },
	format: ['esm'],
	dts: true,
	sourcemap: true,
	clean: true,
});
