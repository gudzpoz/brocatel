import { defaultValueCtx, Editor, rootCtx } from '@milkdown/core';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';

import '@milkdown/theme-nord/style.css';

import { betterViewPlugin } from './views/better-view-plugin';
import { directivePlugin } from './directive-plugin';
import { mdxPlugin } from './mdx-plugin';

import './style.css';
import { normalizationPlugin } from './normalize-plugin';

const markdown = `Mdx: { a + b }

# Heading 1

### Heading 3

[Link 1](#heading-1)`;

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
  .use(normalizationPlugin)
  .use(betterViewPlugin)
  .use(directivePlugin)
  .use(mdxPlugin)
  .create();
