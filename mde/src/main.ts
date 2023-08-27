import { defaultValueCtx, Editor, rootCtx } from '@milkdown/core';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';

import { plugins } from '.';

import '@milkdown/theme-nord/style.css';

import './style.css';

const markdown = `Mdx: { a + b }

# Heading 1

### Heading 3

[Link 1](#heading-1)

:::loop
- One
- Two
`;

Editor
  .make()
  .config((ctx) => {
    ctx.set(rootCtx, '#app');
    ctx.set(defaultValueCtx, markdown);
    ctx.get(listenerCtx).markdownUpdated((_, md) => {
      // eslint-disable-next-line no-console
      console.log(md);
    });
  })
  .config(nord)
  .use(commonmark)
  .use(listener)
  .use(plugins)
  .create();
