/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  assetsInclude: ['**/*.lua'],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'brocatel-mdc',
      fileName: (format) => `brocatel-mdc.${format}.js`
    },
    rollupOptions: {
      /*
      external: ['fengari'],
      output: {
        globals: {
          fengari: 'fengari',
        },
      },
      */
    },
  },
  define: {
    'process.env.FENGARICONF': '\"{}\"',
  },
  plugins: [dts()],
  test: {},
});
