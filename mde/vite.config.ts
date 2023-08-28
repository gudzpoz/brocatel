import { fileURLToPath, URL } from 'node:url';
import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  assetsInclude: ['**/*.lua'],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'brocatel-mde',
      fileName: (format) => `brocatel-mde.${format}.js`
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
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
