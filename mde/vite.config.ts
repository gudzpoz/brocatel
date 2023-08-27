import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  assetsInclude: ['**/*.lua'],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'brocatel-mde',
      fileName: (format) => `brocatel-mde.${format}.js`
    },
  },
  plugins: [dts()],
});
