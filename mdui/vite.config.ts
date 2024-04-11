import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import vue from '@vitejs/plugin-vue';

import { dependencies } from './package.json';

const BUILD_PAGE = process.env.BUILD_TARGET === 'page';

export default defineConfig(BUILD_PAGE ? {
  base: './',
  build: {
    outDir: 'out',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    viteSingleFile({}),
  ],
} : {
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'brocatel-mdui',
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
