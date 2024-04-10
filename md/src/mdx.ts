import type { Root } from 'mdast';
import { mdxExpressionFromMarkdown, mdxExpressionToMarkdown } from 'mdast-util-mdx-expression';
import { mdxExpression } from 'micromark-extension-mdx-expression';
import type { Plugin } from 'unified';

import type { MarkdownData } from './types';

const remarkInlineMdx: Plugin<any[], Root> = function remarkInlineMdx() {
  // Remark-Mdx expects the expressions to be JS expressions,
  // while we use them as Lua ones.
  const data = this.data() as MarkdownData;
  function addTo(field: keyof MarkdownData, ext: any) {
    if (data[field]) {
      (data[field] as Array<any>).push(ext);
    } else {
      data[field] = [ext];
    }
  }
  // We only allow inline mdx (mdxTextExpression), ruling out mdxFlowExpression.
  // Read the definition of mdxExpressionFromMarkdown, mdxExpressionToMarkdown
  //   and mdxExpression to understand the code below.
  const {
    enter: fromMarkdownEnter,
    exit: fromMarkdownExit,
  } = mdxExpressionFromMarkdown();
  const {
    handlers: toMarkdownHandlers,
    unsafe: toMarkdownUnsafe,
  } = mdxExpressionToMarkdown();
  addTo('fromMarkdownExtensions', [{
    enter: {
      mdxTextExpression: fromMarkdownEnter?.mdxTextExpression,
    },
    exit: {
      mdxTextExpression: fromMarkdownExit?.mdxTextExpression,
      mdxTextExpressionChunk: fromMarkdownExit?.mdxTextExpressionChunk,
    },
  }]);
  addTo('toMarkdownExtensions', {
    extensions: [{
      handlers: {
        mdxTextExpression: toMarkdownHandlers?.mdxTextExpression,
      },
      unsafe: toMarkdownUnsafe,
    }],
  });
  addTo('micromarkExtensions', { text: mdxExpression().text });
};

export default remarkInlineMdx;
