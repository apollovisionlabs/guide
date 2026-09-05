import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // treeshake: true routes tsup's cjs output through an esbuild-then-rollup pipeline that
  // strips the banner entirely (verified: "use client" vanishes from both dist files).
  // Disabled to keep the banner, which Next's App Router requires. Unlike the sibling package
  // this one cannot claim sideEffects:false, because that would let a bundler drop an adopter's
  // stylesheet import; sideEffects is ["*.css"] instead, which still eliminates dead JavaScript.
  treeshake: false,
  external: ['react', 'react-dom', '@apollovisionlabs/guide-core'],
  banner: { js: '"use client";' },
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
})
