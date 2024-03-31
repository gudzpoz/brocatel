import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import {
  LoadResult,
  PluginContext,
} from 'rollup';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import vue from '@vitejs/plugin-vue';

// sourcemaps() from Azure/azure-sdk-for-js
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
export function sourcemaps() {
  return {
    name: "load-source-maps",
    async load(this: PluginContext, id: string): Promise<LoadResult> {
      if (!id.endsWith(".js")) {
        return null;
      }
      try {
        const code = await readFile(id, "utf8");
        if (code.includes("sourceMappingURL")) {
          const basePath = path.dirname(id);
          const mapPath = code.match(/sourceMappingURL=(.*)/)?.[1];
          if (!mapPath) {
            this.warn({ message: "Could not find map path in file " + id, id });
            return null;
          }
          const absoluteMapPath = path.join(basePath, mapPath);
          const map = JSON.parse(await readFile(absoluteMapPath, "utf8"));
          return { code, map };
        }
        return { code, map: null };
      } catch (e) {
        function toString(error: any): string {
          return error instanceof Error ? error.stack ?? error.toString() : JSON.stringify(error);
        }
        this.warn({ message: toString(e), id });
        return null;
      }
    },
  };
}

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
  plugins: [sourcemaps(), dts(), vue()],
});
