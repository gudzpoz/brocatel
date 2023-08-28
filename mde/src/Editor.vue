<template>
  <Milkdown />
</template>

<script setup lang="ts">
import { Editor, defaultValueCtx, rootCtx } from '@milkdown/core';
import { listenerCtx, listener } from '@milkdown/plugin-listener';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import { Milkdown, useEditor } from '@milkdown/vue';
import { useNodeViewFactory } from '@prosemirror-adapter/vue';

import { plugins } from '.';
import { useBetterViewPlugins } from './views/better-view-plugin';

import '@milkdown/theme-nord/style.css';

import './style.css';

const markdown = `Mdx: { a + b }

# Heading 1

### Heading 3

[Link 1](#heading-1)

:::loop
- One
- Two

:::if \`true\`
- True
- False
`;

const nodeViewFactory = useNodeViewFactory();

useEditor((root) => Editor.make()
  .config((ctx) => {
    ctx.set(rootCtx, root);
    ctx.set(defaultValueCtx, markdown);
    ctx.get(listenerCtx).markdownUpdated((_, md) => {
      // eslint-disable-next-line no-console
      console.log(md);
    });
  })
  .config(nord)
  .use(commonmark)
  .use(listener)
  .use(useBetterViewPlugins(nodeViewFactory))
  .use(plugins)
);
</script>
