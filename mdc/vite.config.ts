/// <reference types="vitest" />

import path from 'path';
import replace from '@rollup/plugin-replace';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import { dependencies } from './package.json';

export default defineConfig({
  assetsInclude: ['**/*.lua', '**/*.wasm'],
  build: {
    assetsInlineLimit: () => true,
    lib: {
      entry: [path.resolve(__dirname, 'src/index.ts'), path.resolve(__dirname, 'src/cli.ts')],
      name: 'brocatel-mdc',
      formats: ['es', 'cjs'],
      fileName: (format, entry) => {
        const ext = format === 'es' ? '.es.js' : `.cjs`;
        return `${entry}${ext}`;
      },
    },
    rollupOptions: {
      external: ['fs', 'path', ...Object.keys(dependencies).filter((k) => k !== 'wasmoon')],
    },
    sourcemap: true,
  },
  plugins: [
    dts({ rollupTypes: true }),
    {
      ...replace({
        delimiters: ['(?<!\\.)\\b', '\\b(?!\\.)'],
        include: ['**/wasmoon/dist/index.js'],
        preventAssignment: true,
        values: {
          'typeof process': JSON.stringify('undefined'),
          'typeof location': JSON.stringify('object'),
          'location.href': JSON.stringify('http://example.com/'),
        },
      }),
      enforce: 'pre',
    },
    {
      name: 'vite-plugin-no-embed-wasm-dev',
      enforce: 'pre',
      async resolveId(id, _, options) {
        if (!options.ssr || !id.endsWith('glue.wasm')) {
          return null;
        }
        return {
          id: 'data:text/javascript,export default undefined;',
          external: true,
        };
      },
    },
  ],
  test: {
    server: {
      deps: {
        inline: [/wasmoon\/dist\/glue\.wasm$/],
      },
    },
  },
});
