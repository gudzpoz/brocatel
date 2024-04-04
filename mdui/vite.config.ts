import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    viteSingleFile({}),
  ],
});
