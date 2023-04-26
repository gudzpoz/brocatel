/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      name: 'brocatel-mdc',
      fileName: (format) => `brocatel-mdc.${format}.js`
    },
  },
  test: {},
});
