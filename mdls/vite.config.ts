/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    ssr: true,
    lib: {
      entry: [path.resolve(__dirname, 'src/index.ts')],
      name: 'brocatel-mdls',
      formats: ['es', 'cjs'],
      fileName: (format, entry) => {
        const ext = format === 'es' ? '.es.js' : `.cjs`;
        return `${entry}${ext}`;
      },
    },
    rollupOptions: {
      external: ['fs', 'path'],
    },
  },
  plugins: [dts({ rollupTypes: true })],
  test: {},
});
