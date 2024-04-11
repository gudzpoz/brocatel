import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import vue from '@vitejs/plugin-vue';

import { dependencies } from './package.json';

export default defineConfig({
  assetsInclude: ['**/*.lua'],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'brocatel-mde',
      fileName: (format) => `brocatel-mde.${format}.js`
    },
    rollupOptions: {
      external: Object.keys(dependencies),
      output: {
        globals: {
          vue: 'Vue',
        },
        sourcemapIgnoreList: false,
      },
    },
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL(
        './src',
        // @ts-ignore: tsconfig.node.json should be used.
        import.meta.url,
      )),
    },
  },
  plugins: [dts(), vue()],
});
