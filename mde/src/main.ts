import { defaultValueCtx, Editor, rootCtx } from '@milkdown/core';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';

import '@milkdown/theme-nord/style.css';

import { mdxPlugin } from './mdx-plugin';

import './style.css';

const markdown = '{ a + b }';

Editor
  .make()
  .config((ctx) => {
    ctx.set(rootCtx, '#app');
    ctx.set(defaultValueCtx, markdown);
    ctx.get(listenerCtx).markdownUpdated((_, md) => {
      console.log(md);
    });
  })
  .config(nord)
  .use(commonmark)
  .use(listener)
  .use(mdxPlugin)
  .create();
